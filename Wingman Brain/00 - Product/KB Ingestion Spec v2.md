---
name: Knowledge Base Ingestion System — Full Spec v2
status: locked
logged: 2026-04-13
supersedes: KB Ingestion Spec v1.md
---

# Wingman KB Ingestion System — Spec v2

This is the locked, production-grade architecture for the Wingman knowledge base.
Do not build anything that contradicts this document without updating it first.

v2 incorporates 24 issues found in adversarial review of v1. v1 would have shipped
with silent production failures. v2 addresses every one.

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

## Critical Sequencing Rule (Read Before Touching Anything)

The migration, re-ingestion, and code deploy must happen in a specific order.
Doing them out of order causes the live KB to return zero results during the
transition window — possibly for hours.

**Safe order:**
```
1. Deploy code changes first (knowledge-search.ts, kb-signal route, knowledge-signal.ts)
2. Run migration SQL (006_kb_v2.sql)
3. Run re-ingestion (ingest.js --force)
4. After all sources complete: create ivfflat index on prospect_embedding
5. Calibrate threshold
```

**Why code first:** The updated RPC is created in the migration. The updated
knowledge-search.ts must be live before the new RPC is called, or it will call
the wrong function signature.

**Why no bulk DELETE:** Old entries remain in the DB during re-ingestion. They
have quality_score = 'medium' (DEFAULT), trigger_speaker = 'prospect' (DEFAULT),
and technique_embedding (renamed from embedding). They will still return results
via the technique_embedding side of the weighted formula during the transition.
Not perfect results — but not zero. The KB degrades gracefully as sources are
rebuilt, rather than going dark.

---

## Database Schema Changes (006_kb_v2.sql)

```sql
-- ============================================================
-- STEP 1: Add new columns with safe defaults
-- ============================================================

ALTER TABLE public.kb_entries
  -- Core new extraction fields
  ADD COLUMN IF NOT EXISTS prospect_triggers     TEXT,
  ADD COLUMN IF NOT EXISTS exact_script          TEXT,
  ADD COLUMN IF NOT EXISTS situation             TEXT,
  ADD COLUMN IF NOT EXISTS why_it_works          TEXT,
  ADD COLUMN IF NOT EXISTS content_type          TEXT,

  -- call_stage: single primary stage per entry (not an array)
  ADD COLUMN IF NOT EXISTS call_stage            TEXT,

  -- quality_score DEFAULT 'medium' so existing entries pass the RPC filter
  ADD COLUMN IF NOT EXISTS quality_score         TEXT DEFAULT 'medium',

  -- Second embedding vector (prospect-anchored)
  ADD COLUMN IF NOT EXISTS prospect_embedding    vector(1536),

  -- Future-proofed: Objection sequences (not wired yet)
  ADD COLUMN IF NOT EXISTS sequence_id           UUID,
  ADD COLUMN IF NOT EXISTS sequence_step         INTEGER,
  ADD COLUMN IF NOT EXISTS sequence_total_steps  INTEGER,
  ADD COLUMN IF NOT EXISTS sequence_follow_up_triggers TEXT,

  -- Future-proofed: Rep speech monitoring (not wired yet)
  -- DEFAULT 'prospect' so existing entries pass the trigger_speaker filter
  ADD COLUMN IF NOT EXISTS trigger_speaker       TEXT DEFAULT 'prospect',
  ADD COLUMN IF NOT EXISTS rep_trigger_pattern   TEXT,
  ADD COLUMN IF NOT EXISTS rep_trigger_condition TEXT;

-- ============================================================
-- STEP 2: Add CHECK constraints
-- Without these, a typo ('High' instead of 'high') silently
-- excludes entries from search results forever.
-- ============================================================

ALTER TABLE public.kb_entries
  ADD CONSTRAINT quality_score_check
    CHECK (quality_score IN ('high', 'medium', 'low')),
  ADD CONSTRAINT call_stage_check
    CHECK (call_stage IN ('Rapport', 'Discovery', 'Press', 'Confirm', 'Pitch', 'Close')
           OR call_stage IS NULL),
  ADD CONSTRAINT trigger_speaker_check
    CHECK (trigger_speaker IN ('prospect', 'rep'));

-- ============================================================
-- STEP 3: Backfill existing entries so they pass RPC filters
-- ============================================================

UPDATE public.kb_entries
  SET quality_score  = 'medium'
  WHERE quality_score IS NULL;

UPDATE public.kb_entries
  SET trigger_speaker = 'prospect'
  WHERE trigger_speaker IS NULL;

-- ============================================================
-- STEP 4: Rename old embedding column
-- ============================================================

ALTER TABLE public.kb_entries
  RENAME COLUMN embedding TO technique_embedding;

-- ============================================================
-- STEP 5: Drop old RPC, create new dual-vector version
-- NOTE: ivfflat index on prospect_embedding is NOT created here.
-- It is created by ingest.js after all sources complete.
-- Building it on a NULL column is wasteful and produces a
-- degraded index. Wait until the column is populated.
-- ============================================================

DROP FUNCTION IF EXISTS search_kb_entries(vector, float, integer);

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
      -- Weighted similarity: 70% prospect match + 30% technique match
      -- COALESCE handles NULL embeddings during transition window:
      --   - Old entries have NULL prospect_embedding → contribute 0 on that side
      --   - Old entries have technique_embedding → still return results (max score 0.3)
      --   - New entries have both → full weighted score
      (
        COALESCE(0.7 * (1 - (kb_entries.prospect_embedding  <=> query_embedding)), 0) +
        COALESCE(0.3 * (1 - (kb_entries.technique_embedding <=> query_embedding)), 0)
      )::float AS similarity
    FROM public.kb_entries
    WHERE
      kb_entries.trigger_speaker = 'prospect'
      AND kb_entries.quality_score IN ('high', 'medium')
      AND (
        -- Match on prospect_embedding (preferred) OR technique_embedding (fallback)
        -- Avoids zero results when prospect_embedding is NULL during transition
        (1 - (kb_entries.prospect_embedding <=> query_embedding)) >= similarity_threshold
        OR (
          kb_entries.prospect_embedding IS NULL
          AND (1 - (kb_entries.technique_embedding <=> query_embedding)) >= 0.65
        )
      )
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;
```

---

## 3-Pass Pipeline

### Startup Sequence (ingest.js on every run)

```
1. Reset stuck sources: any source in 'processing' state → reset to 'failed'
   (guards against crashed previous runs)

2. Validate API keys: test ping Anthropic + OpenAI before spending anything
   Fail fast with a clear error if keys are missing or invalid.

3. Check transcript cache: query kb_sources for which sources already have
   transcripts stored. Whisper cost only applies to uncached ones.

4. Print full cost breakdown and require y/n confirmation:
   - Whisper: $X (only uncached sources)
   - Pass 1 Haiku: ~$Y
   - Pass 2 Sonnet: ~$Z
   - Pass 3 Haiku: ~$W
   - Embeddings: ~$0.02
   - Total: ~$X+Y+Z+W+0.02

5. Process sources sequentially (not in parallel — avoids rate limits)
```

### Force Flag

Re-ingestion requires `--force` flag:
```bash
node ingest.js --force
```

Without `--force`, the script skips sources with `status = 'complete'`. This is
the standard duplicate guard. `--force` overrides it and reprocesses all 37 sources.
All 37 are currently `complete` from the first ingestion — so `--force` is required.

### Per-Source Flow

```
For each source:
  1. Mark status = 'processing'
  2. Fetch transcript (from cache if stored, else Whisper)
  3. Pass 1 — Content Intelligence (Haiku)
  4. Pass 2 — Deep Extraction (Sonnet) with 5-minute AbortController timeout
  5. Validate each extracted entry (required fields check)
  6. Pass 3 — Quality Gate (Haiku) + trigger count floor check
  7. Generate dual embeddings (batched, atomic)
  8. Delete this source's existing kb_entries
  9. Insert new entries
  10. Mark status = 'complete', update entry_count
  11. Log any warnings to knowledge-base/ingest_warnings.log
      AND write to kb_sources.error_message for UI visibility

After ALL sources complete:
  12. Create ivfflat index on prospect_embedding (lists = 20)
```

**Why delete happens at step 8, not before step 1:**
If the script crashes between steps 1–6, the source stays `processing`,
is reset to `failed` on next startup, and retried from scratch. The old
entries are still in the DB during that window — live calls still get results.
Deleting early would create a zero-results window on crash.

---

### Pass 1 — Content Intelligence (Claude Haiku)

**Input:** Full transcript + video metadata
**Purpose:** Understand the video before extracting from it.
**Key insight:** Content type drives extraction strategy — not duration.

**Output schema:**
```json
{
  "content_type": "role_play | lecture | objection_demo | coaching_call | short_clip | interview",
  "primary_focus": "objection_handling | discovery | closing | rapport | full_process",
  "call_stages_covered": ["Discovery", "Close"],
  "has_role_play": true,
  "extraction_notes": "Specific guidance for Pass 2 about this video's format.",
  "classification_confidence": "high | medium | low"
}
```

**IMPORTANT: `estimated_technique_count` is NOT included in Pass 1 output.**
It must never be passed to Pass 2 — it would cap extraction at the estimate
and cause techniques to be missed.

**If `classification_confidence = 'low'`:**
- Write warning to `knowledge-base/ingest_warnings.log`
- Write to `kb_sources.error_message`: "Classification confidence low — manual review recommended"
- Still proceed with extraction (don't skip the video)

**Extraction strategy by content_type:**
- `short_clip` → 1-3 atomic techniques. Already curated. No segmentation.
- `objection_demo` → Each demo = its own entry. Max trigger variation.
- `role_play` → Extract from full dialogue. Prospect lines = trigger examples.
- `lecture` → All teachable moments. Full extraction.
- `coaching_call` → Focus on corrections: what the rep did wrong + the fix.
- `interview` → Principles only. Skip conversational filler.

---

### Pass 2 — Deep Extraction (Claude Sonnet)

**Input:** Full transcript + Pass 1 extraction_notes
**`max_tokens`: 16000 (set explicitly — default 8192 truncates large videos mid-JSON)**
**AbortController timeout: 300,000ms (5 minutes)**

A hung Sonnet call with no timeout stalls the entire queue indefinitely.
If timeout fires: log the error, mark source `failed`, continue to next source.

**Why no transcript splitting:**
A 3-hour transcript ≈ 36,000 input tokens — well within Sonnet's 200K context window.
Splitting creates merge complexity and deduplication problems. Don't split.

**Output schema — each entry:**
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
  "why_it_works": "Isolates whether the objection is real or a stall. Forces the prospect to commit on fit before re-engaging on price.",
  "coach_name": "Cole Gordon"
}
```

**Extraction rules:**
- 30+ prospect trigger variations — non-negotiable target in the prompt
- `call_stage` must be ONE value from: Rapport | Discovery | Press | Confirm | Pitch | Close
  If a technique applies to multiple stages, pick the stage where it's MOST needed.
  The CHECK constraint will reject arrays or comma-separated values — don't pass them.
- `exact_script` is verbatim rep words, first person, natural spoken language
- `situation` is one sentence only
- `why_it_works` explains the principle, not the script
- `coach_name` extracted but NEVER shown to users
- If a technique has multiple variations, extract each as a separate entry
- Ignore: introductions, origin stories, filler, motivation content with no tactical takeaway

**After JSON.parse(), validate required fields before inserting:**
Required fields: `technique_name`, `call_stage`, `situation`, `prospect_triggers`, `exact_script`
If any required field is missing or empty string: skip the entry, log it, continue.
Missing `why_it_works` is logged as a warning but does not discard the entry.

**JSON parsing:**
Strip markdown code fences before parsing (Sonnet sometimes wraps output):
```js
const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
```
Wrap in try/catch. On parse failure: log the raw output + error, mark source `failed`, continue.

---

### Pass 3 — Quality Gate (Claude Haiku)

**Input:** Each validated entry from Pass 2
**Purpose:** Score quality. Only high + medium enter the KB.

**Scoring criteria:**
- `high` — Clear trigger, verbatim exact_script, specific situation, immediately usable live
- `medium` — Good technique, slightly vague trigger OR script needs minor polish, still usable
- `low` — Anecdote, too generic, not applicable live, or key fields are weak

**Trigger count floor (checked before quality gate):**
Before passing an entry to Haiku, count the non-empty lines in `prospect_triggers`.
Normalize first: strip numbering (`1. `, `- `), collapse blank lines.
If count < 20: auto-downgrade to `low` regardless of semantic quality.
20 is the floor (not 30) — some techniques have fewer natural variations.
30 is the target in the prompt. Under 20 signals a prompt failure on this entry.

**If ALL entries from a source are discarded:**
Write to: `knowledge-base/ingest_warnings.log`
Write to: `kb_sources.error_message` = "All entries discarded — review video quality or extraction prompt"
Set: `entry_count = 0`, `status = 'complete'`
This is visible in the KB server UI (which reads from kb_sources).

**Expected pass rate:** 65-80%. If >85% → gate too loose. If <40% → gate too strict.

---

## Embedding Strategy (Dual-Vector)

Two embeddings generated per entry. Both succeed or neither is inserted (atomic).

```
Embedding A — prospect_embedding (PRIMARY — 70% weight at search time)
  Input: All prospect_triggers joined as a single newline-separated text block
  Why: Search queries are prospect speech. This closes the semantic gap.

Embedding B — technique_embedding (SECONDARY — 30% weight)
  Input: situation + " " + technique_name + " " + why_it_works
  Why: Catches moments where the prospect doesn't use a known phrase but
       the situation matches.
```

**Batching:**
Collect ALL texts for a source (all prospect_trigger blocks + all technique blocks).
Send as ONE OpenAI API call using the array input format — not one call per entry.
Map results back by array index (OpenAI returns in input order — verified).
This eliminates rate limit risk and is ~80x faster than sequential calls.

**Atomicity:**
Both embeddings are generated in memory before any DB write.
If either embedding fails: skip the entry, log it, continue to next entry.
Never insert a partial record (one NULL embedding). The weighted formula
returns a degraded score for NULL embeddings — partial records pollute search.

---

## Similarity Threshold

**The threshold lives in TWO places. Both must match.**

1. RPC default parameter: `DEFAULT 0.72` (in 006_kb_v2.sql)
2. Code constant: `SIMILARITY_THRESHOLD` in `src/lib/wingman/knowledge-search.ts`

The RPC uses whatever the client sends. If the code constant isn't updated,
the effective threshold is whatever the old value was (currently 0.65) — not 0.72.
Update both or neither.

**Starting value: 0.72**
Tune after the first real calibration run (see Post-Ingestion section below).

---

## knowledge-search.ts Changes

The following changes are required for exact_script and why_it_works to reach Haiku:

1. Update `SIMILARITY_THRESHOLD` constant to match RPC default
2. Update `KBMatch` interface to include `exact_script` and `why_it_works`
3. Update `formatResults()` to include these fields in the text passed to kb-signal
4. The RPC RETURNS TABLE already includes exact_script and why_it_works — the
   client just needs to select and use them

Without these changes, the fields are ingested into the DB and silently ignored.

---

## Re-Ingestion Plan

**Do NOT use the v1 bulk DELETE approach. It wipes the entire KB before
re-ingestion starts. A crash leaves you with zero results for hours.**

Instead: per-source delete (step 8 of the per-source flow above).
Old entries stay alive until their source successfully re-ingests.

**To trigger re-ingestion:**

```bash
cd "/Users/sebastianperez/Desktop/Wingman CC/knowledge-base"
node ingest.js --force
```

No SQL needed to reset sources. `--force` overrides the duplicate check.
The script marks each source `processing` as it starts, `complete` when done.

---

## Cost Estimate (37 videos, corrected)

| Step | Details | Cost |
|------|---------|------|
| Whisper re-transcription | Only for uncached sources. Check cache first. | ~$0–4 |
| Pass 1 — Haiku | 37 × ~30K input tokens × $0.25/M | ~$0.28 |
| Pass 2 — Sonnet | 37 × ~30K input + ~10K output tokens | ~$11–13 |
| Pass 3 — Haiku | Per-entry scoring pass | ~$0.50 |
| Dual embeddings | OpenAI text-embedding-3-small | ~$0.02 |
| **Total** | | **~$12–18** |

The v1 estimate of ~$13 was missing Pass 1 cost and used a low estimate for Pass 2 output tokens.
The script prints the exact breakdown before asking y/n.

---

## Post-Ingestion Calibration (Required)

After all 37 sources complete:

1. Add `?debug=true` flag to `kb-signal` route that returns similarity scores
2. Run 10 test trigger phrases against the live system:
   - "this is too expensive"
   - "I need to think about it"
   - "I need to talk to my partner"
   - "what makes you different"
   - "send me some information"
   - "can I get a discount"
   - "I've tried things like this before"
   - "I'm not sure I'm ready"
   - "that's a big commitment"
   - "what if it doesn't work"
3. Log actual similarity scores for each
4. Tune `SIMILARITY_THRESHOLD` in knowledge-search.ts based on real results
5. **Remove `?debug=true` before beta launch** — it exposes KB internals

---

## Files That Will Change

| File | What changes |
|------|-------------|
| `supabase/migrations/006_kb_v2.sql` | Schema + RPC (use the exact SQL in this spec) |
| `knowledge-base/ingest.js` | Full rewrite — startup sequence, --force flag, 3-pass pipeline, batched embeddings, 5-min timeout, per-source delete |
| `knowledge-base/.gitignore` | Add `ingest_warnings.log` (must not be committed) |
| `src/lib/wingman/knowledge-search.ts` | Update SIMILARITY_THRESHOLD, KBMatch interface, formatResults() |
| `src/app/api/wingman/kb-signal/route.ts` | Pass exact_script, why_it_works, situation to Haiku |
| `src/lib/wingman/knowledge-signal.ts` | Use exact_script + why_it_works in Haiku prompt |

Deploy order: code changes → migration SQL → re-ingestion.

---

## What's Future-Proofed But Not Yet Wired

### Objection Sequences
Schema columns: `sequence_id`, `sequence_step`, `sequence_total_steps`, `sequence_follow_up_triggers`
Build context: `Wingman Brain/00 - Product/Future Features/Objection Sequences (Option A).md`

### Rep Speech Monitoring
Schema columns: `trigger_speaker = 'rep'`, `rep_trigger_pattern`, `rep_trigger_condition`
Build context: `Wingman Brain/00 - Product/Future Features/Rep Speech Monitoring.md`
UX: User-facing toggle in Settings. Default OFF.

### Dual Visual Brain (User-Facing)
Brain 1: KB Graph (what Wingman is trained on — universal)
Brain 2: Offer Brain Visualizer (what Wingman learned about this user — unique)
Build context: `Wingman Brain/00 - Product/Future Features/KB Visual Brain.md`

---

## Coaches in the Current Video Library

Jeremy Miner, Christian Polk, Cole Gordon, Andres Contreras-Grossi,
Alex Beck, Matthew Rider, Alex Hormozi (and others).

Coach names are extracted during ingestion and stored in `coach_name`.
They are NEVER shown to users in signal cards or anywhere in the UI.

---

## Known Limitations (Acceptable For Now)

- `ingest_warnings.log` is write-only during batch. KB server UI reads from `kb_sources.error_message` instead. No live streaming of batch progress.
- Old entries during transition window score at max 0.3 (technique_embedding only). They can still surface results but won't score as high as re-ingested entries. This is by design — graceful degradation.
- Hash collision risk in knowledge-search.ts cache (32-bit hash). Negligible at current scale. Not worth fixing now.
- In-memory cache in knowledge-search.ts is unbounded. Self-limits at 60s TTL. Not a problem at current Railway memory allocation.
- Model strings (Haiku, Sonnet) are hardcoded version strings. If Anthropic deprecates them, calls return 404. Monitor Anthropic deprecation notices.
