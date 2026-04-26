# Current Sprint

Last updated: 2026-04-25

This is the first file Claude reads at session start. It answers: where are we, what's next, and what's blocking us.

---

## What Was Just Completed (2026-04-25 — Legal Pages, ToS Recording Law Section)

- **`/terms` and `/privacy` confirmed live** — both pages already existed. P0 compliance blocker cleared.
- **Section 5 "Recording Laws & Your Responsibility" added to ToS** — shifts wiretap liability to user. Lists all 14 all-party consent states, cites ECPA, explicit indemnification clause. Mirrors Cluely's ToS-only approach but more explicit.
- **Operator updated to "Wingman LLC"** on both pages — Sebastian's personal name removed. LLC to be filed in MN before first paid users.
- **"Setters" removed from Terms** — closers-only language, setters are future expansion.
- **Pushed** — commit `8c569bc`, Railway auto-deployed.

---

## What Was Just Completed (2026-04-25 — Bug Fixes, Compliance, Auth, Onboarding)

- **Issue #32 confirmed fixed** — HUD mouse passthrough already correct. `setIgnoreMouseEvents(true, { forward: true })` at creation + hover-only capture on interactive elements. No code change needed, marked resolved.
- **Issue #31 fixed** — profanity rule hardened in `src/app/api/ai/chat/route.ts`. Changed from soft style suggestion to hard constraint: "Never use profanity, vulgar language, slang, or expletives. Not once, not even for emphasis. This is a hard rule." Marked resolved.
- **Issue #33 — wiretap compliance basic posture set** — ToS-only approach (same as Cluely) adopted for beta. `compliance_acknowledged_at` now logged at account creation via DB trigger. Signup ToS line updated. Website Plan created (`Wingman Brain/03 - GTM/Website Plan.md`). `/terms` and `/privacy` flagged as P0 blockers before public beta.
- **SalesStyle onboarding step removed** — was collecting data Wingman doesn't use. `OnboardingClient.tsx` flow now: welcome → offer → tutorial → vaultnudge → building.
- **Signup auth fixes (4):** (1) show/hide password toggles with inline Eye/EyeOff SVGs; (2) "Didn't get it? Resend email" button in emailSent view; (3) Google OAuth `ERR_CONNECTION_REFUSED` fixed by adding `http://localhost:3000/**` to Supabase Redirect URLs allowlist (no code change); (4) diagnosed silent duplicate account issue — must delete from Supabase Auth Users dashboard, not just profiles table.
- **Compliance.tsx built** — checkbox screen component created at `src/components/onboarding/Compliance.tsx`. Not wired into onboarding flow (deemed too scary for conversion). Available if needed.

---

## What Was Just Completed (2026-04-25 — Competitive Research + Financial Modeling)

- **Cluely competitive intelligence completed** — full deep-dive on product, pricing, subprocessors, positioning. Full report in `2026-04-25.md` build log.
- **Polling vs. WebSocket push cost analysis** — 191 Sonnet polls + 252 Haiku KB scans per 60-min call costs $1.98 in AI. WebSocket push drops that to $0.37 (81% reduction). Decision: migrate to Pusher.
- **Background Haiku KB scan identified as quick win** — `useWingmanPoller.ts` scans KB every 10 seconds regardless of call activity. Costs $0.41/call. Removing it is a 30-min standalone fix that doesn't require the full push migration.
- **Recall.ai pricing confirmed** — 2026 rate is $0.50/hr (not the old $0.0117/min from earlier screenshot). Launch plan quote received: $0.45/hr for 6,000 hours over 12 months with white-glove Slack support.
- **Unit economics modeled** — margin calculator built at `margin-calculator.html`. At Launch plan + push + 65 calls/month avg: $179/month = 73% gross margin. Worst-case heavy user (130 calls, 60 min): 37.6% at $179. All numbers are model assumptions — no real user data yet.
- **Pricing direction set** — $179–$199/month, unlimited calls. Target users (high-ticket closers doing 100+ calls/month) will churn on any call cap.
- **Full undetectability scoped** — `setContentProtection(true)` already in `main.ts:172`. Still needs: Dock hide during calls, app switcher removal, Settings toggle.
- **Infrastructure decisions made** — PostHog (analytics), Pinecone (vector DB), Vercel (hosting) all added to roadmap.

---

## What Was Just Completed (2026-04-23 — Planning + Compliance Research)

- **Bug #30 fix reverted** — transcript deletion step removed from `post-call/route.ts`. Stress-testing found the fix would've silently broken "Ask Wingman" chatbot (reads transcript via `src/app/api/ai/chat/route.ts:125`) and Flight Log transcript view (`FlightLogTab.tsx:465`). Issue #30 closed as superseded.
- **Issue #33 logged — wiretap compliance initiative** — critical pre-beta blocker. 2025 case law (*Ambriz v. Google*, *Brewer v. Otter.ai*) confirmed AI transcription is subject to CIPA + ECPA. Full research agent report saved at `05 - Operations/Wiretap Compliance Research.md`. 5-layer plan scoped.
- **Two V2 Offer Brain features killed after adversarial review** — custom objection handles and rep blind spots. Both fail the same attribution problem: text transcripts can't see tonality/authority/pacing, so any stored pattern is either too generic or biases the next call wrong.
- **Marketing honesty principles saved** — `03 - GTM/Marketing Honesty Principles.md`. Wingman is a tool in the tool belt, not the whole belt. Will shape website copy, onboarding, and FAQ.
- **Voice chatbot idea captured in Inbox** — ElevenLabs voice coaching is a V2+ differentiator. Not now.
- **Decision locked: keep transcripts indefinitely, user-deletable** — 1-year auto-delete was tempting but Sebastian's own usage (6+-month-old transcripts) and industry norm (Gong/Chorus indefinite) made indefinite the cleaner answer. Breach exposure is the real risk, handled via user-controlled delete in #33.

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

## What Was Just Completed (2026-04-19 — Flight Plan Feature)

- **Flight Plan SQL run** — `flight_plans` table created, `flight_plan_snapshot` and `pillar_coverage` JSONB columns added to `calls` table. Run manually in Supabase SQL Editor.
- **Flight Plan UI built** — `FlightPlanTab.tsx` (new), guided walkthrough mode (spotlight effect, scrolls to active section), all-at-once edit mode, 7 fields across 4 sections, paper plane nav icon with animation in `Sidebar.tsx`.
- **Flight plan API built** — `api/flight-plan/route.ts` (new), GET + POST (upsert), server-side validation.
- **Flight plan snapshot wired to session** — `session/route.ts` fetches flight plan in parallel with profile at call start (3s timeout via Promise.race), snapshot stored in `calls.flight_plan_snapshot`. Zero extra latency on poll hot path.
- **Flight plan injected into live poll** — `poll/route.ts` reads `flight_plan_snapshot` from call record, formats into `REP'S FLIGHT PLAN:` context block, prepended to user message. AbortController (10s) + prompt caching (`cache_control: ephemeral`) also added.
- **Post-call pillar evaluation built** — `post-call/route.ts` now evaluates all 7 pillars (core_problem, cant_diy, cost_of_waiting, dream_outcome, investment_readiness, whos_involved, why_you) against the full transcript using Sonnet. Flight plan context injected so evaluation is offer-specific. Results written to `calls.pillar_coverage` as independent step (never blocks debrief). `max_tokens` raised 512 → 1,536.
- **Types updated** — `FlightPlan`, `PillarResult`, `PillarCoverage` added to `src/types/index.ts`.

**Step 5 complete** — Framework Coverage card in Flight Log Debrief tab. 7-pillar scorecard with color-coded score (green/orange/red), covered pillars show AI evidence quote, missed pillars show a coaching hint. Design previewed and approved.

---

## What Was Just Completed (2026-04-26 — Pusher WebSocket Push Migration)

- **Background Haiku KB scan removed (#0a)** — `useWingmanPoller.ts` no longer runs KB search every 10 seconds. Only fires on keyword trigger hits. Saves $0.41/call.
- **Pusher migration fully built (#0b)** — 7 steps complete: `pusher` + `pusher-js` installed, `src/lib/pusher.ts` singleton created, `/api/pusher/auth` private channel auth endpoint built, `poll/route.ts` and `kb-signal/route.ts` now push via Pusher and return `{ ok: true }`, `useWingmanPoller.ts` subscribes to Pusher channel and handles both event types, Railway env vars added. TypeScript-clean (`npx tsc --noEmit` = zero errors). Cost: $1.98 → $0.37/call (81% reduction). Latency: up to 90s delay → instant.
- **NOT YET TESTED** — Electron dev window is stuck on blank `/onboarding` page. Fix before testing: Supabase → profiles → set `onboarding_completed = true` → save. Then in Electron DevTools console: `window.location.assign('http://localhost:3000/dashboard')`.

---

## What's In Progress

- Nothing currently in progress.

---

## What's Next (Priority Order)

0. 🚨 **Build `/terms` and `/privacy` pages on meetwingman.ai** — P0 before any public beta user signs up. The signup ToS line links to `/terms` — that URL must resolve. Copy direction in `Wingman Brain/03 - GTM/Website Plan.md`. Issue #33 basic posture is now set; these pages are the remaining compliance blocker.

0a. ✅ **Quick win: eliminate background Haiku KB scan** — DONE. Removed 2026-04-26.

0b. ✅ **WebSocket push migration (Pusher)** — DONE. Built 2026-04-26. NOT YET TESTED on a live call — Electron dev window blocked by onboarding issue. Fix: Supabase → profiles → `onboarding_completed = true`. Then test per steps in 2026-04-26.md.

0c. 📊 **PostHog analytics** — wire up PostHog for product analytics. Free at beta scale. Need to know: which features fire, whether signal cards get dismissed immediately, which stages cause drop-off. Dedicated session. Add `NEXT_PUBLIC_POSTHOG_KEY` to env.

0d. 🕵️ **Full undetectability buildout** — `setContentProtection(true)` already done at `electron/main.ts:172`. Still needs: `app.dock.hide()` during active calls, remove from CMD+Tab switcher, user-facing toggle in Settings tab. Use case: reps sharing screen during demos should never expose signal cards to prospect. Dedicated session.

0e. 🗄️ **Pinecone migration** — replace pgvector (Supabase RPC `search_kb_entries`) with Pinecone vector search in `src/lib/wingman/knowledge-search.ts`. Build for scale now while only 419 entries exist. Steps: create Pinecone index (dimension 1536, cosine), write migration script to export vectors from Supabase → Pinecone, update `knowledge-search.ts` to use Pinecone SDK. Dedicated session. Add `PINECONE_API_KEY` to env.

0f. ☁️ **Vercel migration** — move web/backend hosting from Railway to Vercel. Better Next.js cold starts, edge functions, per-branch preview deploys. Not urgent while Railway is stable. Steps: export env vars, connect repo to Vercel, re-point `meetwingman.ai` DNS. Dedicated session.

0g. 📋 **Recall.ai Launch plan** — reply to sales rep before signing. Two questions to ask: (1) overage rate above 6,000 hours, (2) 3,000-hour starter option. Do not sign until answers received. Once signed, update Recall rate in `margin-calculator.html`.

---

## What's Next (Old Priority Order — below new items)

0. 🚨 **Wiretap compliance initiative (Issue #33)** — critical pre-beta blocker. Multi-session build. Start with Layer 1: rep-facing ToS + one-screen onboarding compliance acknowledgment checkbox. This is the minimum legal foothold to ship any public beta. Subsequent layers: user-controlled transcript deletion UI → website compliance page → auto-post chat message at call start → calendar invite auto-insert → unshipped kill-switch code. Full game plan in `05 - Operations/Wiretap Compliance Research.md`.

1. **Transcript tester tool (local dev only)** — paste a real sales call transcript into a simple local UI, run it through the post-call scoring pipeline (same system prompt + pillar evaluation), and see the full visual output. Goal: let Sebastian verify pillar scoring quality without needing a live call. Build as a standalone HTML file or simple Next.js dev-only page. No auth required — local only.

2. **Signal card simulation testing** — the best way to test signal card quality without waiting for a real sales call. Plan: find a full high-ticket info product sales call transcript (YouTube or personal archive), use Claude to generate 50 variations (different objections, different prospect personas, different stages), then run them through the live signal card pipeline and evaluate which cards fired, when, and what they said. Goal: catch misfires, missed moments, and quality issues before beta. No code needed first — start by sourcing a real gold-standard transcript.

3. **Ask Wingman automated test suite** — pressure test the chatbot with hundreds of automated test cases run directly from terminal (no app UI needed). Define a list of failure modes we're testing for (profanity, hallucinations, out-of-scope answers, confidently wrong advice, etc.) and have Claude generate and run 200+ diverse queries against the live `ai/chat` route. Log pass/fail per query. Goal: surface quality issues systematically before beta testers find them manually.

4. **Test signal card quality during a live call** — end-to-end pipeline has never been tested on a real call. Must verify signal cards fire at the right moments, coaching KB search returns meaningful results, and latency stays under 1s.

5. **Next re-ingestion session** — fix Issues #28 + #29: add `trigger_type` classification (`objection` | `buying_signal`) to junction table, improve Pass 2 prompt for trigger diversity. Re-ingest all sources.

6. **Stripe billing end-to-end test**

7. **Beta onboarding email** — must include quarantine removal command for non-notarized app.

8. **Wingman Intelligence graph visualizer** — add an Obsidian-style node graph to the dashboard showing that rep's AI brain (Offer Brain nodes, objections, patterns, call history connections). Grows over time. Not mission-critical — V1.5 feature, but worth planning. No immediate action needed.

---

## Current Blockers

- **App not Apple-notarized** — beta testers must run quarantine command manually. (Known Issue #5)

---

## How to Update This File

After every build session, Claude updates this file:
- Move completed items to "What Was Just Completed"
- Update "What's In Progress" with anything mid-flight
- Update "What's Next" priority order based on what changed
- Add anything new to "Current Blockers" or remove resolved blockers
