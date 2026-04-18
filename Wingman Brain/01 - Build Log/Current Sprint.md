# Current Sprint

Last updated: 2026-04-18

This is the first file Claude reads at session start. It answers: where are we, what's next, and what's blocking us.

---

## What Was Just Completed (2026-04-18 — Mission Intel Deep Dive)

- **Deep dive flow built** — 3-turn confirmation flow inside global chat modal. No navigation, no button. Claude identifies a call, confirms it, offers the dive, then fetches the full transcript and switches the modal into a dedicated per-call coaching session.
- **CALL_MATCH at Step 2** — Claude embeds `CALL_MATCH:{...}` when offering the dive. Server parses and strips it, returns as `callSuggestion`. Client stores silently as `pendingCallSuggestion` — nothing shown to user.
- **DIVE_NOW at Step 3** — Claude appends `DIVE_NOW` when user accepts. Server detects with case-insensitive regex, auto-retries Supabase fetch 2x (500ms delay), returns `diveReady: { openerReply, callData }`. Client shows staggered messages then switches mode.
- **Transcript cap removed** — `capTranscript()` deleted entirely. Full transcript goes in. 2-hour hard stop is the natural ceiling.
- **Prompt caching added** — `cache_control: ephemeral` on the context block in single_call mode. ~90% cheaper on follow-up turns within 5-minute window. `anthropic-beta` header added conditionally.
- **Security guard** — `fetchCallWithRetry` always includes `.eq("user_id", user.id)`. UUID_REGEX validation on all `pendingCallId` inputs.
- **State clears on modal close** — `pendingCallSuggestion`, `activeSingleCall`, `singleCallHistoryRef` all reset via backdrop click, ✕ button, and ESC.
- **Files changed:** `ai/chat/route.ts` (full rewrite), `FlightLogTab.tsx` (significant changes to global chat section)

---

## What Was Just Completed (2026-04-18 — Mission Intel Coaching KB + Call Triage)

- **Mission Intel now searches `kb_coaching_entries`** — added `searchCoachingKnowledge()` to `knowledge-search.ts`. Coaching chatbot previously searched the live signal card KB (wrong table). Now queries the coaching-specific table with lower threshold (0.60) and 5 results instead of 3.
- **Call triage feature built** — global mode detects when user is asking about a specific past call, asks for confirmation ("Are you talking about the call with X on Apr 12?"), then surfaces a CTA button that navigates directly into that call's single-call mode with full transcript context.
- **CALL_MATCH protocol** — server-side: Claude embeds a `CALL_MATCH:{...}` marker in its response when it identifies a specific call; server strips the marker, validates the JSON, returns `callSuggestion` as a separate field. Frontend: attaches to last bubble of the response, renders blue "Open [Name] — [Date] →" button.
- **Call IDs now sent in global context** — `callSummaries` payload includes `id` field so Claude can reference exact call UUIDs in CALL_MATCH. Added to `buildGlobalContext()` format string.
- **Files changed:** `knowledge-search.ts`, `ai/chat/route.ts`, `FlightLogTab.tsx`

---

## What Was Just Completed (2026-04-17 — Junction Table + Calibration Session)

- **Calibration tool built** — `knowledge-base/calibrate.js` runs 10 test phrases through the live pipeline and shows exact similarity scores. Reusable: run after every new batch of videos.
- **Junction table architecture shipped** — `kb_prospect_triggers` table: one row per trigger phrase, each with its own embedding. 6,554 rows backfilled from 215 entries. HNSW index created. Migration 008 run in Supabase.
- **Scores went from 0.38 to 0.65–0.88** — all critical signal card moments now fire correctly. Threshold set to 0.65.
- **ingest.js updated** — future ingestion auto-populates junction table. No manual steps needed on new videos.
- **Issues #25 and #27 resolved** — KB pipeline fully wired, embedding timeout fixed.
- **Issues #28 and #29 logged** — negation blindness and duplicate triggers earmarked for next re-ingestion session.
- **Pushed to Railway** — commit `819d518`, auto-deploy triggered.

---

## What Was Just Completed (2026-04-15 — Dual KB Build Session)

- **Dual KB architecture fully built.** All 5 steps from the previous session plan completed.
- **SQL migration 007 run.** `kb_entries` renamed → `kb_signal_card_entries`. `search_kb_entries` RPC replaced with `search_kb_signal_card_entries`. `kb_coaching_entries` table created with `search_kb_coaching` RPC.
- **4 code files updated.** `knowledge-search.ts`, `ingest.js`, `server.js`, `cleanup.js` all updated to use new table/RPC names. Zero stray `kb_entries` references remain.
- **backfill-coaching.js built and run.** 431 rows copied from `kb_signal_card_entries` → `kb_coaching_entries` with re-embedding. Verified in Supabase.
- **cleanup.js --apply run.** 216 bad signal entries deleted. 42 polished to high. `kb_signal_card_entries` now has 215 clean entries (~156 high, 58 medium).

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

- Nothing currently in progress.

---

## What's Next (Priority Order)

1. **Test signal card quality during a live call** — end-to-end pipeline has never been tested on a real call. Must verify signal cards fire at the right moments, coaching KB search returns meaningful results, and latency stays under 1s.

2. **Playbook page** — pre-call framework setup. Rep configures once. Three tiers: locked core, default-on toggleable, custom. Only remaining unbuilt V1 beta item.

3. **Next re-ingestion session** — fix Issues #28 + #29: add `trigger_type` classification (`objection` | `buying_signal`) to junction table, improve Pass 2 prompt for trigger diversity. Re-ingest all sources.

4. **Stripe billing end-to-end test**

5. **Beta onboarding email** — must include quarantine removal command for non-notarized app.

---

## Current Blockers

- **Playbook page not built** — Wingman has no rep-specific framework context beyond defaults until this exists.
- **App not Apple-notarized** — beta testers must run quarantine command manually. (Known Issue #5)

---

## How to Update This File

After every build session, Claude updates this file:
- Move completed items to "What Was Just Completed"
- Update "What's In Progress" with anything mid-flight
- Update "What's Next" priority order based on what changed
- Add anything new to "Current Blockers" or remove resolved blockers
