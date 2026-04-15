---
name: Knowledge Base Ingestion System — Full Spec v1
status: approved
logged: 2026-04-10
---

[[Architecture]] | [[KB Ingestion Spec v2]]

# Wingman KB Ingestion System — Spec v1

This is the approved architecture for the Wingman knowledge base.
Do not build anything that contradicts this document without updating it first.

---

## The Core Problem This Solves

Current KB returns 0 matches on every search because entries are written from the
coach's perspective but search queries are raw prospect speech. Semantic mismatch.

```
What's stored:  "When a prospect raises a price concern, use value reframing..."
What's searched: "this is too expensive"
Similarity:      0.31 — no match, no card fires
```

Every architectural decision in this spec is designed to close that gap.

---

## Database Schema Changes

### New columns on kb_entries

```sql
-- Core new fields
ALTER TABLE public.kb_entries
  ADD COLUMN prospect_triggers      TEXT,         -- 30+ prospect speech examples (newline-separated)
  ADD COLUMN exact_script           TEXT,         -- Verbatim words the rep says
  ADD COLUMN situation              TEXT,         -- One sentence: what's happening on the call
  ADD COLUMN call_stage             TEXT,         -- Rapport | Discovery | Press | Confirm | Pitch | Close
  ADD COLUMN why_it_works           TEXT,         -- The principle behind the technique
  ADD COLUMN quality_score          TEXT,         -- high | medium | low
  ADD COLUMN content_type           TEXT,         -- full_training | role_play | objection_demo | coaching_call | short_clip | interview

  -- Second embedding vector (prospect-anchored)
  ADD COLUMN prospect_embedding     vector(1536), -- Embedded from prospect_triggers (primary search anchor)

  -- Future-proofed: Objection sequences (not wired in live pipeline yet)
  ADD COLUMN sequence_id            UUID,         -- Links entries in the same objection sequence
  ADD COLUMN sequence_step          INTEGER,      -- Which step: 1, 2, 3
  ADD COLUMN sequence_total_steps   INTEGER,      -- How many steps in this sequence
  ADD COLUMN sequence_follow_up_triggers TEXT,    -- What prospect says after this step to trigger next step

  -- Future-proofed: Rep speech monitoring (not wired in live pipeline yet)
  ADD COLUMN trigger_speaker        TEXT DEFAULT 'prospect', -- 'prospect' or 'rep'
  ADD COLUMN rep_trigger_pattern    TEXT,         -- Description of rep behavior that triggers this card
  ADD COLUMN rep_trigger_condition  TEXT;         -- 'duration_threshold' | 'pattern_absence' | 'sequence_violation'

-- Rename old embedding column for clarity
ALTER TABLE public.kb_entries
  RENAME COLUMN embedding TO technique_embedding;

-- Index the new prospect_embedding column
CREATE INDEX ON public.kb_entries
  USING ivfflat (prospect_embedding vector_cosine_ops)
  WITH (lists = 100);
```

### Updated search_kb_entries RPC

```sql
-- Drop old function, replace with dual-vector weighted search
CREATE OR REPLACE FUNCTION search_kb_entries(
  query_embedding      vector(1536),
  similarity_threshold float   DEFAULT 0.72,
  match_count          integer DEFAULT 3
)
RETURNS TABLE (
  id              uuid,
  technique_name  text,
  situation       text,
  exact_script    text,
  why_it_works    text,
  call_stage      text,
  quality_score   text,
  similarity      float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
    SELECT
      kb_entries.id,
      kb_entries.technique_name,
      kb_entries.situation,
      kb_entries.exact_script,
      kb_entries.why_it_works,
      kb_entries.call_stage,
      kb_entries.quality_score,
      -- Weighted: 70% prospect match + 30% technique match
      (
        0.7 * (1 - (kb_entries.prospect_embedding  <=> query_embedding)) +
        0.3 * (1 - (kb_entries.technique_embedding <=> query_embedding))
      )::float AS similarity
    FROM public.kb_entries
    WHERE
      kb_entries.trigger_speaker = 'prospect'  -- only prospect-triggered entries for now
      AND kb_entries.quality_score IN ('high', 'medium')
      AND (1 - (kb_entries.prospect_embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;
```

---

## Ingestion Pipeline (3-Pass)

### Pass 1 — Content Intelligence
**Model:** Claude Haiku (fast, cheap ~$0.05/video)
**Input:** Full transcript + video metadata (title, duration, channel)
**Purpose:** Understand the video before extracting from it.
**Key insight:** Content type matters more than duration. Pass 1 decides the extraction strategy.

**What it returns:**
```json
{
  "content_type": "role_play | lecture | objection_demo | coaching_call | short_clip | interview",
  "primary_focus": "objection_handling | discovery | closing | rapport | full_process",
  "call_stages_covered": ["Discovery", "Close"],
  "estimated_technique_count": 12,
  "has_role_play": true,
  "extraction_notes": "Video uses role-play format — coach plays both sides. Extract from full dialogue, not just coach commentary. Treat prospect lines as trigger examples."
}
```

**Extraction strategy set by Pass 1 (not by duration):**
- `short_clip`: Extract as 1-3 atomic techniques. No segmentation. Already curated.
- `objection_demo`: Extract each demo as its own technique with maximum trigger variation.
- `role_play`: Extract from full dialogue. Prospect lines become trigger examples.
- `lecture`: Extract all teachable moments. Full multi-pass approach.
- `coaching_call`: Focus on corrections — what the rep did wrong and the fix.
- `interview`: Extract principles only. Skip conversational filler.

---

### Pass 2 — Deep Extraction
**Model:** Claude Sonnet
**Input:** Full transcript + Pass 1 output (extraction_notes guide the prompt)
**Purpose:** Extract every technique with a full, richly structured entry.

**Each entry extracted:**
```json
{
  "technique_name": "Value Isolation Reframe",
  "call_stage": "Close",
  "situation": "Prospect just said the price is too high after hearing the full pitch.",
  "prospect_triggers": [
    "this is too expensive",
    "that's a lot of money",
    "I can't afford that right now",
    "that's more than I expected",
    "is there a payment plan",
    "can you do better on the price",
    "that's out of my budget",
    "I need to think about the investment",
    "price is a concern for me",
    "I wasn't expecting it to be that much",
    "that's a big number",
    "I don't know if I can justify that",
    "let me look at my finances",
    "the price is holding me back",
    "money is tight right now",
    "that's more than we budgeted",
    "I need to run the numbers",
    "is there a discount",
    "what's your best price",
    "I've seen cheaper options",
    "the ROI isn't clear to me",
    "I'm not sure the juice is worth the squeeze",
    "can we start smaller",
    "do you have a trial option",
    "I need to see more value before committing",
    "the timing isn't great financially",
    "that would stretch our budget",
    "I need to get approval for that amount",
    "my partner would never agree to that",
    "let me think about whether I can make it work"
  ],
  "exact_script": "If price wasn't a factor — if we could somehow make it work financially — would this be the obvious next step for you?",
  "why_it_works": "Isolates whether the objection is real or a stall. Forces the prospect to commit on fit before re-engaging on price. If they say yes, price is the only barrier. If they hesitate, there's a deeper objection to uncover.",
  "coach_name": "Cole Gordon"
}
```

**Extraction rules:**
- 30+ prospect trigger variations per technique — non-negotiable
- `exact_script` must be verbatim words the rep says, in first person, natural spoken language
- `situation` is one sentence only
- `why_it_works` explains the principle, not the script
- `coach_name` is extracted but NEVER shown to users
- If a technique has multiple variations, extract each as a separate entry
- Ignore: introductions, origin stories, filler, motivation content with no tactical takeaway

---

### Pass 3 — Quality Gate
**Model:** Claude Haiku
**Input:** Each extracted entry from Pass 2
**Purpose:** Score every entry before it enters the KB. Only high + medium pass.

**Scoring criteria:**
- `high`: Clear prospect trigger, verbatim exact_script, specific situation, immediately usable on a live call
- `medium`: Good technique, slightly vague trigger OR script needs minor polish, still usable
- `low`: Anecdote, too generic, not directly applicable on a live call, or missing key fields

**Only `high` and `medium` entries enter the KB. `low` entries are discarded.**

Expected pass rate for well-produced sales training content: 65-80%.
If >85% pass, the quality gate is too permissive — tighten the prompt.
If <40% pass, the gate is too strict — loosen it.

---

## Embedding Strategy (Dual-Vector)

Two embeddings generated per entry. Both stored in Supabase.

```
Embedding A — prospect_embedding (PRIMARY search anchor)
  Input: All 30+ prospect_triggers joined as a single text block
  Why: Search queries are prospect speech. This makes them match.

Embedding B — technique_embedding (SECONDARY, replaces old embedding)
  Input: situation + " " + technique_name + " " + why_it_works
  Why: Catches moments where the trigger isn't explicit — Wingman recognizes
       the situation even if the prospect doesn't use a known phrase.
```

**At search time:**
```
Weighted similarity = 0.7 × (prospect_embedding match) + 0.3 × (technique_embedding match)
```

Prospect_embedding has 70% weight because the search query IS prospect speech.
Technique_embedding has 30% weight as a semantic safety net.

---

## Retrieval Pipeline (Live Call)

```
Prospect says: "I'm not sure the juice is worth the squeeze"
     │
     ▼
Embed prospect speech → query_vector  (OpenAI, ~150ms)
     │
     ▼
Dual-vector weighted search in pgvector  (~80ms)
  Threshold: 0.72 similarity
  Returns: top 3 matches (high + medium quality only)
     │
     ▼
Secondary quality gate: does the top result fit the current call stage?
  If call_stage mismatch → skip this result, try next
     │
     ▼
Send top technique to Claude Haiku  (~200ms)
  Input: situation + exact_script + why_it_works + live call context
  Output: { headline (≤5 words), subtext (one sentence) }
     │
     ▼
Signal card on screen
TOTAL: ~430ms ✅ under 500ms target
```

---

## Similarity Threshold

**Set at 0.72** (not 0.65, not 0.90).

Why not 0.90: Prospects are creative. "I'm not sure the juice is worth the squeeze" and
"this is too expensive" score below 0.90 against each other even though they mean the same
thing. 0.90 would miss real objections constantly.

Why not 0.65: Too permissive once the embeddings are high quality. We'd surface
techniques that are related but not the right fit for the exact moment.

Why 0.72: With 30+ prospect triggers properly embedded, 0.72 is a high bar that still
catches natural language variation. Tune this number up or down based on real call data
after the first 10-20 calls with the new KB.

---

## Re-Ingestion Plan

### SQL to run in Supabase (in order)

```sql
-- Step 1: Add new columns (run first)
-- [full ALTER TABLE statements from schema section above]

-- Step 2: Delete existing entries and reset sources for re-ingestion
DELETE FROM public.kb_entries;
UPDATE public.kb_sources
SET status = 'failed',
    entry_count = 0,
    processed_at = NULL,
    error_message = 'Reset for re-ingestion with new schema (prospect_triggers, dual embeddings)';
```

### Cost estimate (37 videos)
| Step | Cost |
|------|------|
| Whisper re-transcription | ~$4 |
| Pass 1 — Content Intelligence (Haiku) | ~$0.50 |
| Pass 2 — Deep Extraction (Sonnet) | ~$8 |
| Pass 3 — Quality Gate (Haiku) | ~$0.50 |
| Dual embeddings (OpenAI) | ~$0.02 |
| **Total** | **~$13** |

---

## What's Future-Proofed But Not Yet Wired

### Objection Sequences
Schema columns: `sequence_id`, `sequence_step`, `sequence_total_steps`, `sequence_follow_up_triggers`
Build context saved to: `Wingman Brain/00 - Product/Future Features/Objection Sequences (Option A).md`

### Rep Speech Monitoring
Schema columns: `trigger_speaker`, `rep_trigger_pattern`, `rep_trigger_condition`
Build context saved to: `Wingman Brain/00 - Product/Future Features/Rep Speech Monitoring.md`
UX: User-facing toggle in Settings. Default OFF.

### Dual Visual Brain (User-Facing)
Brain 1: KB Graph (what Wingman is trained on — universal)
Brain 2: Offer Brain Visualizer (what Wingman learned about this user — unique)
Build context saved to: `Wingman Brain/00 - Product/Future Features/KB Visual Brain.md`

---

## Files That Will Change When We Build This

| File | What changes |
|------|-------------|
| `knowledge-base/ingest.js` | Full rewrite — 3-pass pipeline, new extraction prompt, dual embeddings |
| `src/lib/wingman/knowledge-search.ts` | Dual-vector weighted search, updated threshold |
| `supabase/migrations/006_kb_v2.sql` | New schema columns, updated RPC |
| `src/app/api/wingman/kb-signal/route.ts` | Passes new fields (exact_script, situation) to Haiku |
| `src/lib/wingman/knowledge-signal.ts` | Uses exact_script + why_it_works in the prompt |

---

## Coaches in the Current Video Library
Jeremy Miner, Christian Polk, Cole Gordon, Andres Contreras-Grossi,
Alex Beck, Matthew Rider, Alex Hormozi (and others).

Coach names are extracted during ingestion and stored in `coach_name`.
They are NEVER shown to users in signal cards or anywhere in the UI.
