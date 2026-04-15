# Current Sprint

Last updated: 2026-04-15

This is the first file Claude reads at session start. It answers: where are we, what's next, and what's blocking us.

---

## What Was Just Completed (2026-04-15 — KB Architecture Session)

- **Track A complete** — `knowledge-search.ts` updated: threshold 0.65→0.72, KBMatch interface now matches RPC columns (situation, exact_script, why_it_works, call_stage, quality_score), format string updated so Haiku receives all 5 fields per technique. `knowledge-signal.ts` updated: Haiku now instructed to base headline on exact_script when available, use why_it_works for subtext context.
- **Track B complete** — `ingest.js` Pass 2 prompt updated (first-person trigger rule + exclude non-sales content), Pass 3 prompt updated (score low for offer-specific scripts, third-person triggers, non-sales content). `cleanup.js` built and rewritten with full 5-criteria definition + medium-entry polish step (Sonnet polishes, Haiku re-scores).
- **KB dry run complete** — 431 entries reviewed: 215 marked low (bad for signal cards), 42 polished to high, 61 still medium, 111 already high. cleanup.js --apply NOT yet run. No DB changes made.
- **Dual KB architecture decided** — Major architectural decision: signal card KB and coaching chatbot KB will be two separate tables. See decision details below under "What's Next".

---

## What Was Just Completed (2026-04-13 — KB Re-ingestion Session)

- **KB Ingestion Spec v2 locked** — went through Plans A → B → C → hardened plan → adversarial subagent review → 24 issues found → all fixed. Spec saved to `Wingman Brain/00 - Product/KB Ingestion Spec v2.md`.
- **SQL migration 006_kb_v2.sql run and verified** — 15 new columns added to kb_entries, embedding renamed to technique_embedding, new dual-vector search RPC live, CHECK constraints added, existing entries backfilled so they still appear in search during transition.
- **`knowledge-base/ingest.js` fully rewritten** — 3-pass pipeline (Haiku classify → Sonnet extract → Haiku quality gate), dual embeddings, transcript cache, --force flag, 5-minute Sonnet timeout, batched OpenAI embeddings, atomic dual embedding insertion, per-source delete, retry logic for 529 overloads (10s/30s/60s backoff), ingest_warnings.log, cost estimation gate with y/n confirmation.
- **Re-ingestion in progress** — 3 runs attempted. 529 overloads on runs 1-2 (peak hours). Credits ran out mid-run 2 (auto-reload too low + wrong Anthropic account). New API key created under sebastian@meetwingman.ai. Run 3 in progress at session end with cached transcripts (no Whisper cost).
- **KB quality issues identified by QA** — 3 categories of bad entries found: (1) offer-specific exact_scripts, (2) third-person prospect triggers, (3) non-sales content. Cleanup script needed.
- **Anthropic account consolidated** — API now under sebastian@meetwingman.ai (console.anthropic.com). Old key was under sebmattiasperez@gmail.com. Both .env.local and Railway updated.

---

## What Was Just Completed (2026-04-10 — session 2)

- **Signal card prompt updated to two-tier format** — `knowledge-signal.ts` now returns JSON `{ headline, subtext, source }`. Haiku gets stage context, stage-based format rules (Rapport/Confirm/Pitch = headline only, Discovery/Press/Close = headline + subtext). Markdown code fence stripping added before JSON parse.
- **Stage labels fixed** — `STAGE_DESCRIPTIONS` now uses the real 6-stage labels (`Discovery`, `Press`, `Confirm`, etc.) instead of the old 8-stage NEPQ names that didn't exist in the codebase.
- **KB signal route updated** — `parseCard()` removed, JSON fields mapped correctly to `signal_header`/`signal_text`. Accepts `current_stage` from poller.
- **Poller guard fixed (critical bug)** — `if (!data?.signal_text)` → `if (!data?.signal_header)`. Empty string subtext was silently suppressing all headline-only cards.
- **Keyword trigger cards updated to two-tier format** — all 9 triggers rewritten. Headlines are now ≤5-word actionable directives (e.g. "If price wasn't a factor?"). Subtext trimmed to one sentence per card.
- **Issue #21 logged** — Embedding latency / Redis cache need tracked in Known Issues.

---

## What Was Just Completed (2026-04-10)

- **Signal card visual redesign** — `electron/hud/index.html` fully updated. Cards now bottom-left, dark unified style, fade in/out animation, 18px bold white text, ambient pulsing dot replaces "Listening…", two-tier format (headline + support text for objection/close cards). All changes based on cognitive science research (see `00 - Product/Signal Card Design Science.md`).
- **Brain files corrected for contradictions** — `Prompt Library.md` headline word limit updated (20 → ≤5 words, two-tier format rules added to actual Haiku prompt). `Signal Card Examples.md` fully rewritten in two-tier format. `Bubble Discipline.md` updated with ambient dot as third UI element + design change log.
- **New research doc created** — `00 - Product/Signal Card Design Science.md` — full scientific basis for every design decision with named studies, marketing copy snippets, color spec, and adaptation timeline.
- **Design spec preview file** — `tasks/signal-card-preview.html` — downloadable visual reference with side-by-side current vs. optimized, annotated with research citations.

---

## What Was Just Completed (2026-04-09)

- **`/wrap` skill built** — session end automation. Writes daily build log, updates brain files, commits, asks for push approval. Active from next session restart.
- **Obsidian brain added to GitHub** — `Wingman Brain/` removed from `.gitignore`, full vault pushed to repo for cross-device sync.
- **Brain files cleaned up** — Roadmap updated (signal cards working), Decisions Log updated (4 new entries), 2026-04-07 build log written retrospectively.
- **Stop hook hardened** — `.claude/settings.local.json` now explicitly reminds Claude to run `/wrap` before ending a session.

---

## What Was Just Completed (2026-04-07)

- **Transcript dedup fixed** — Recall.ai was firing the same utterance 7-9x (or more). Root cause was likely listener stacking across call sessions + SDK-level duplicates. Fix: `realtimeListenerRegistered` flag ensures the realtime-event delegate is registered only once per app session (after `startRecording`). Dedup logic changed from a 500ms time window to last-text-per-speaker comparison — only emits when the speaker's text changes.
- **Poll chunk size limit raised** — poll route had a 10K char hard cap. With broken dedup, buffer grew to 57K+ chars and got rejected with 400. Raised to 50K as a safety net. With correct dedup, chunks are well under 1K per poll.
- **"No Show" and "Other" disposition bug fixed** — database `calls_outcome_check` constraint didn't include "No Show" or "Other" but the HUD had both as options. SQL migration run: constraint updated to include all valid outcomes.
- **Processing skeleton now waits for full post-call data** — skeleton used to clear the moment disposition was saved, before the debrief was ready. Changed to clear only when both `outcome` AND `summary` are populated. User now sees the full entry (transcript + debrief) when the skeleton disappears — no hard refresh needed.
- **Safety valve reduced** — from 10 minutes to 2 minutes (if post-call job fails, skeleton clears after 2 min instead of 10).
- **CLAUDE.md updated** — added The Plan Review Loop rule: all implementation plans must go through internal revision rounds before being presented to Sebastian. Only the final battle-tested plan gets shown.
- **Dev command saved to memory** — correct command is `npm run electron:dev`, not `npm run dev`.

---

## What Was Just Completed (prior session)

- Signal cards confirmed firing — first working signal card appeared on a real test call.
- 90-second cooldown bypassed for keyword/Alert signals.
- Prospect name auto-detected from transcript.
- Live/Processing skeleton added to dashboard.
- Disposition save bug fixed (hud-outcome getUser fix).
- handleEndCall try/finally hardened.

---

## What's In Progress

- **Dual KB architecture build** — architecture decided, nothing built yet. Full plan below.

---

## What's Next (Priority Order)

### IMMEDIATE — Next session (do these in order, do NOT skip steps)

#### CONTEXT: Dual KB Architecture Decision
We decided to split the knowledge base into two separate tables:
- **`kb_entries`** (existing) — signal card only. High bar. Prospect-triggered, verbatim script, universal. Surgical.
- **`kb_coaching_entries`** (new) — coaching chatbot. Broad bar. Techniques + mindset + frameworks + habits + anything real sales content. Used by Mission Intel chatbot (not yet wired).

**Key rule:** Everything ingested goes into `kb_coaching_entries`. Only entries that pass the strict signal card quality gate ALSO go into `kb_entries`. Signal is a subset of coaching.

**One ingestion URL in → ingest.js routes content to both tables automatically. Rep never sees two separate systems.**

**Gap-detection signal cards** ("you haven't touched on timeline/budget/decision maker") are Playbook cards — powered by the Playbook system, NOT the KB. Do not confuse these with KB signal cards.

#### CONTEXT: KB Dry Run Results (2026-04-15)
cleanup.js dry run completed on 431 entries:
- 215 → should be removed from signal card KB (bad quality for live call use)
- 42 → Sonnet polished them, Haiku confirmed high quality
- 61 → still medium after polish, manual review recommended
- 111 → already high quality, untouched
- 2 → errors (JSON parse failure, skipped)
cleanup.js --apply has NOT been run. No DB changes made yet.

#### Step 1 — SQL migration: create `kb_coaching_entries` table
New table schema (simpler than kb_entries — no dual vectors, no prospect_triggers requirements):
```sql
id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
source_id uuid REFERENCES kb_sources(id) ON DELETE CASCADE,
topic text NOT NULL,           -- what is this technique/concept about
content text NOT NULL,          -- full explanation, can be long
coach_name text,
call_stage text,                -- optional, nullable
content_type text,              -- technique, mindset, framework, habit, objection_handling, etc.
tags text,                      -- comma-separated topics
embedding vector(1536),         -- embedded from topic + content (NOT prospect speech)
created_at timestamptz DEFAULT now()
```
Also create search RPC: `search_kb_coaching(query_embedding, similarity_threshold, match_count)`
Run in Supabase SQL Editor. No code push needed.

#### Step 2 — Backfill: copy all 431 current `kb_entries` into `kb_coaching_entries`
Write a backfill script (`knowledge-base/backfill-coaching.js`) that:
- Reads all rows from kb_entries
- Maps fields: technique_name→topic, full_detail+why_it_works→content, coach_name, call_stage, content_type
- Re-embeds using topic + content (single embedding, not dual-vector)
- Inserts into kb_coaching_entries
- Logs progress, handles errors without crashing

#### Step 3 — Delete bad signal entries from `kb_entries`
After backfill confirms success:
- Update cleanup.js to DELETE from kb_entries (not mark low) for the 215 bad-for-signal entries
- Run cleanup.js --apply
- Result: kb_entries becomes tight, surgical, signal-card-only table (~216 entries)

#### Step 4 — Update `ingest.js` for dual-pipeline
One URL in → both tables populated going forward:
- Pass 1 (Haiku): classify content type — same as now
- Pass 2A (Sonnet): extract ALL techniques broadly → insert into kb_coaching_entries
- Pass 2B (Sonnet): extract ONLY signal-card-ready techniques → candidates for kb_entries
- Pass 3 (Haiku): quality gate → only surgical entries make it into kb_entries
Two separate Sonnet extraction passes for quality (not combined into one prompt).
coaching extraction: broad, no 30+ trigger requirement, embed topic+content
signal extraction: strict, 30+ first-person triggers required, dual-vector embedding

#### Step 5 — Calibration (deferred from previous sprint)
- Run 10 test trigger phrases with ?debug=true on kb-signal route
- Log actual similarity scores
- Tune SIMILARITY_THRESHOLD if needed
- Remove debug flag before beta

### AFTER DUAL KB IS BUILT

6. **Wire Mission Intel chatbot to `kb_coaching_entries`** — separate session. Build search_kb_coaching RPC, update the ai/chat route to query coaching KB.

7. **Playbook page** — pre-call framework setup. Rep configures once. Three tiers: locked core, default-on toggleable, custom. This powers gap-detection signal cards (completely separate from KB).

8. **Stripe billing end-to-end test**

9. **Beta onboarding email** — must include quarantine removal command for non-notarized app.

10. **"Retry analysis" button in Flight Log** — low priority.

### IMMEDIATE — Next session (do these in order)

1. ~~Wait for Run 3 to finish~~ ✅ Done — 38/38 succeeded
2. ~~Run ivfflat index~~ ✅ Done — switched to HNSW (ivfflat failed due to Supabase memory limit of 32MB). HNSW index created on `prospect_embedding`.

3. **Update `src/lib/wingman/knowledge-search.ts`:**
   - Change `SIMILARITY_THRESHOLD` constant from 0.65 → 0.72
   - Update `KBMatch` interface to include `exact_script` and `why_it_works`
   - Update `formatResults()` to pass these fields through to kb-signal route

4. **Update `src/app/api/wingman/kb-signal/route.ts`:**
   - Pass `exact_script`, `why_it_works`, `situation` to Haiku

5. **Update `src/lib/wingman/knowledge-signal.ts`:**
   - Use `exact_script` and `why_it_works` in the Haiku prompt

6. **Build `knowledge-base/cleanup.js`** — post-ingestion quality sweep:
   - Re-score all existing KB entries with updated prompts
   - Discard offer-specific exact_scripts (coach's specific business details)
   - Discard third-person prospect triggers
   - Discard non-sales content (personal habits, mindset routines)
   - Does NOT re-extract from source videos — just re-scores existing entries

7. **Update Pass 2 + Pass 3 prompts in `ingest.js`:**
   - Pass 2: add explicit first-person trigger rule + exclude personal habits/routines
   - Pass 3: add offer-specific script detection rule

8. **Calibration:**
   - Run 10 test trigger phrases with ?debug=true on kb-signal route
   - Log actual similarity scores
   - Tune SIMILARITY_THRESHOLD if needed
   - Remove debug flag before beta

### AFTER KB IS FULLY LIVE

4. **Playbook page** — pre-call framework setup. Rep configures once. Three tiers: locked core, default-on toggleable, custom.

5. **Stripe billing end-to-end test**

6. **Beta onboarding email** — must include quarantine removal command for non-notarized app.

7. **"Retry analysis" button in Flight Log** — low priority. Show retry button when `summary` is null on a completed call.

---

## Current Blockers

- **KB pipeline code not yet updated** — Steps 3-5 of build plan not done. `knowledge-search.ts`, `kb-signal` route, and `knowledge-signal.ts` must be updated before the new KB is live on real calls.
- **KB quality issues** — cleanup script needed before KB is production-ready. Bad entries confirmed: offer-specific scripts, third-person triggers, non-sales content.
- **Playbook page not built** — Wingman has no rep-specific framework context beyond defaults until this exists.
- **App not Apple-notarized** — beta testers must run quarantine command manually. (Known Issue #5)

---

## How to Update This File

After every build session, Claude updates this file:
- Move completed items to "What Was Just Completed"
- Update "What's In Progress" with anything mid-flight
- Update "What's Next" priority order based on what changed
- Add anything new to "Current Blockers" or remove resolved blockers
