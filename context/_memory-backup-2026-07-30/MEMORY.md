# Wingman CC — Project Memory

## What Wingman Is
Real-time AI sales copilot for high-ticket closers. Electron desktop app (macOS) wrapping a Next.js web app. Recall.ai captures live audio → Deepgram streaming transcription (inside Recall) → real-time chunks → on-screen cards.

## Current State (2026-07-28) — READ FIRST (reconcile with git before trusting prose; status drifts — [[feedback-status-lives-in-git]])
- **🚨 THE LAUNCH CUTLINE IS LAW — read `tasks/launch-plan.md` before proposing ANY work. THE RULE: "does this block a Test Pilot from using the 4 arrows?" If no → Parking Lot, even (especially) if the idea is good.** Full context: [[project-launch-cutline]].
- **✅ v0.1.29 SHIPPED + PUBLISHED LIVE 2026-07-27** (signed, notarized, **auto-update confirmed working by Sebastian**). Merged: PR #54 (payload) · #55 (bump) · #56 (no-transcript fixes) · #57 (wrap). Five sessions of held-local work is now out: summarizer Cole-brain, voice Phase 0, Flight Recorder, Owner dashboard, post-call pill morph + AI outcome auto-detect, bugs #52/#53, confrontation dial (pinned/inert). Session log: `Wingman Brain/01 - Build Log/2026-07-28.md`.
- **🎨 2026-07-29 — DASHBOARD REBUILD shipped locally** (branch `feat/design-tokens`, 8 commits, NOT pushed): tokens + Tailwind v4 + Home rebuild + Coach chat + dark mode; colour debt 590 → 286. Detail + the open dark-mode fix: [[project-dashboard-rebuild]].
- **✅ 2026-07-30 — DARK MODE DONE + dashboard trimmed + 3 LIVE COACH BUGS FIXED.** Log `2026-07-30.md`. **Branch `feat/design-tokens` is 17 commits ahead of origin/main and UNPUSHED — decide on pushing.** Dark mode fixed at ONE token (elevation is LIGHTNESS in dark and you can't go DOWN; rules → Design Language §3f). Flight Plan + Signal Vault deleted (Objection Vault kept) · Settings + Appearance toggle · Intel "coming soon" · outcome row 4 elements → 1 · colour debt 590 → **58**. **THREE LIVE BUGS found while PLANNING the coach bar:** the "dive into that call" handoff **never worked and burned a Sonnet call + quota on every later message**; the quota counter under-reported, could show "23 of 20", and locked an overnight tab at the cap; plus a state lift for the bar. Known Issues #57–60. **🔴 NEXT = PR 4 of `tasks/plan-coach-bar.md`** (two carry-forwards first). See [[project-dashboard-rebuild]] · [[project-unified-coach-bar]].
- **Session 1b = the dashboard rebuild** (un-parked 2026-07-28). Plan `tasks/todo.md` · Sebastian sweeps PRODUCTION via `tasks/dashboard-sweep.md`. Flight Log still owes: raw `cant_diy`/`investment_readiness`/`why_you` keys leaking (Known Issues #55/#56) + "Topics Missed Before Pitch" is a third rendering of STAGE BREAKDOWN + FRAMEWORK COVERAGE. **Then Session 2 = the Replay Harness** (blocked on Land Geek transcripts; keep LOCAL + git-ignored).
- **🎨 TWO OPEN DESIGN CALLS FOR SEBASTIAN (2026-07-28):** (1) **typeface** — app ships **Geist** (`src/app/layout.tsx` assigns it to `--font-sans`, shadowing the token) but Design Language §4 says system sans/SF Pro; left unchanged, it restyles every screen. (2) **Flight Plan vs Sales DNA overlap** — two tabs collecting the same shape of info; merge or differentiate. Also found: **Signal Vault is still live** in the sidebar despite `CLAUDE.md` listing it as retired.
- **💰 MEASURED cost: ~$1.25/recorded hour, 75–80% margin on a typical user.** Prompt caching already shipped everywhere; summarizer sends only the transcript delta. Recall stays until a post-launch DIY replacement — [[project-recall-replacement-shadow-mode]].
- **🎯 CARD DOCTRINE LOCKED 2026-07-28 (→ voice week):** the test is *"has the prospect revealed anything real?"*, NEVER minutes-in. Nothing real → **Wingman admits it has nothing** and may NEVER invent a question from its own head; quiet state = `"Nothing to work with yet."` The work is SUBTRACTION — two prompt instructions currently COMMAND a question unconditionally. **↓ renamed "Discover"** (user-facing labels ONLY — never rename `dig-prompt.mjs`/`DIG_SYSTEM_PROMPT`/eval ids); ← stays **"Answer"** → **↑ Objection · ← Answer · → Close · ↓ Discover**. **Exhaustion detection pulled from the parking lot → PRE-BETA REQUIRED.**
- **⚠️ LESSON 2026-07-28:** three adversarial review rounds on a two-bug fix caught a fix that was **completely inert** (keyed off `call.duration`, which no client has ever written) and one that was **worse than the bug** (asserted "nothing was captured" from an empty array that usually means "not loaded"). **Typecheck + 194 tests passed every time.** Deterministic gates cannot catch wrong assumptions — always run `wingman-reviewer`, and never let a branch sit unmerged (PR #53's squash-merge cost a 15-file conflict).

### Older context (pre-2026-07-28)
Per-session detail lives in `Wingman Brain/01 - Build Log/YYYY-MM-DD.md` — read those rather than duplicating here. Standing items: post-call flow redesign shipped in v0.1.29 ([[project-post-call-flow]]) · card voice rework is the queued grind ([[project-card-voice-rework]]) · live cards are HOTKEY-SUMMONED via the 4-arrow compass, never autonomous · Design Language track + Live Hub ([[project-wingman-live-hub]]) · auto-updater fixed and live ([[reference-auto-update-architecture]]) · transcripts retained text-only, audio/video NEVER stored.

## Key URLs
- Production: https://app.meetwingman.ai · Dev: http://localhost:3000 · KB ingestion tool: http://localhost:3333/ (local only)

## Architecture (6 layers)
INPUT → DETECT (trigger classifier) → RETRIEVE (embed + pgvector) → GENERATE (Haiku, <800ms) → POST-CALL (async Sonnet) → STORAGE

## AI Models
- **Live objection card (hotkey-summoned)** + **dig card** + **Live summarizer (Belief Ladder, ~2-min bg timer → `calls.live_summary`)**: Claude **Sonnet 4.6** (`claude-sonnet-4-6`), streaming, NO KB. **close** = client-side readiness chip (no AI). **answer** = NOT built. *(Corrected 2026-07-22 — the old "answer/dig/close may still use Haiku/KB" was STALE; the KB block in kb-signal is dead code, Phase-5 removal #37. See [[project-answer-card-redesign]].)*
- **Post-call job**: Claude Sonnet — async, quality over speed. **Embeddings**: OpenAI `text-embedding-3-small`. **Ingestion extraction**: `claude-sonnet-4-20250514`.

## Prompt Budget (~1,300 tok/trigger)
System ~300 · Offer Brain ~200 · Session memory ~200 · KB techniques (top 3) ~450 · Trigger chunk ~150

## Key Files
- `electron/main.ts` — Electron app, IPC handlers, HUD/tray window mgmt · `electron/recall.ts` — Recall.ai SDK (NO simulation mode; testing needs a real meeting)
- `src/app/api/wingman/kb-signal/route.ts` — hotkey-summoned live card endpoint (objection/dig stream) · `src/app/api/wingman/session/route.ts` — call session
- `src/hooks/useWingmanPoller.ts` — client polling + triggers + summarizer + `summarizeNow()` · `src/lib/wingman/close-readiness.mjs` — → close readiness scoring (pure)
- `src/lib/wingman/{belief-ladder,objection-signal,dig-signal,dig-prompt.mjs,knowledge-search,knowledge-signal}.ts` · `knowledge-base/{ingest.js,server.js}` (port 3333)

## Database Tables
Existing: profiles, offers, qualification_criteria, vault_objections, vault_signals, calls, call_stages, call_transcript · KB: kb_sources, kb_entries (vector 1536) + RPC search_kb_entries

## Engineering Standards
- [Recall detection constraints](reference_recall_detection_constraints.md) — meeting detection is Space-bound (Zoom/Meet), SDK limit; deploy 429 is OUR limiter
- [Auto-update + release architecture](reference_auto_update_architecture.md) — public wingman-releases repo, PAT, notarization, isQuitting-before-quitAndInstall
- [Status lives in git, not prose](feedback_status_lives_in_git.md) — reconcile notes against `gh`/`git` at session start; they lag reality
- [Run Plan Review Loop before presenting](feedback_plan_review_loop.md) — stress-test failure modes first
- [Machine-check list comparisons](feedback_machine_check_comparisons.md) — use `comm`/`diff`, never visual scanning
- [Dev server vs production build](feedback_dev_server_vs_build.md) — never build while the dev server runs; screenshots after DOM changes are stale frames

## Communication Style
- [Short responses](feedback_response_length.md) — Sebastian gets overwhelmed by long answers. Plain English, brief.

## Dev Commands
- [Correct dev command](feedback_dev_command.md) — Always `npm run electron:dev`, never `npm run dev`

## KB Content
- [More videos + Instagram Reel support needed](project_kb_content_needs.md) — expand KB; Instagram Reel ingestion requested

## Launch
- [The launch cutline + Test Pilot beta](project_launch_cutline.md) — 🚨 READ FIRST: `tasks/launch-plan.md` is the scope contract; "does this block a Test Pilot?" gates all new work
- [Replace Recall with our own capture (shadow mode)](project_recall_replacement_shadow_mode.md) — decided: first post-launch project, 55–75% cost cut, migrate only at proven parity

## Future Projects
- [Unified Coach bar](project_unified_coach_bar.md) — 🔴 NEXT: PR 4 of `tasks/plan-coach-bar.md`. PRs 1-3 done (dive fix, quota, state lift); two carry-forwards before building; PR 5 = stream real phases, never fake ones
- [Dashboard rebuild](project_dashboard_rebuild.md) — dark-mode elevation FIXED (one token); Flight Plan + Signal Vault deleted; Settings + theme toggle shipped; debt 590 → 111; local on `feat/design-tokens`
- [Close-readiness + surface-agreement follow-ups](project_close_readiness_followups.md) — QUEUED: "See what's missing" dropdown, strictness test, premature-buying-signal redirect card, shared readiness engine so all cards agree; brief in `tasks/close-readiness-followups.md`
- [Core card voice rework](project_card_voice_rework.md) — 🔴 NEXT: kill AI tics in the base objection/dig prompts (Sebastian's rewrites → few-shot + deterministic tic gate + human-in-loop). Voice before dial.
- [Confrontationalness dial](project_confrontationalness_dial.md) — BUILT + gated, PINNED behind the voice rework; local branch `feat/confrontation-dial`, not pushed; migration 010 not run.
- [A/V recording — Wingman as notetaker](project_av_recording_notetaker.md) — **HOT (research spun up 2026-07-15):** store call VIDEO+AUDIO so Wingman replaces Fathom/Granola (sales-team call reviews need video). Stay invisible, offload ALL legal/consent to the user ("act as Recall"). **Invariant #6 "never store audio/video" is now UP FOR REVISION** — not settled. Custom/white-label bot-name if a bot is required.
- [Wingman live hub](project_wingman_live_hub.md) — Live Hub core BUILT 2026-07-15 (pill + logo + drag/persist + content-protect + fixed-height smooth cog + expanding canvas color wheel + subtle transform waveform; wingman-reviewer BLOCK→fixed). NEXT in-progress: REAL listening waveform via Recall `audio_mixed_raw.data` (plan-reviewed, hardened, approved — stores NOTHING). Formality + card-bg toggle = Build 2.
- [Offer-Aware Wingman — THE MOAT](project_offer_aware_moat.md) — capture rep Sales DNA (offer+discovery) → inject into live cards; quality never gated; Phase 1a+1b shipped. **QUEUED #4 = Phase 1d:** wire raw Sales DNA into the OBJECTION card (only dig has it) for money-anchor specificity + the PAYMENT-TERMS CONFIGURATOR (Yes/No + list-terms → conditionally suppresses the financial-trade lever; add to Sales DNA capture PAGE)
- [In-call Prospect Anchor Capture](project_prospect_anchor_capture.md) — 🆕 QUEUED: capture every significant prospect anchor live (goal #, why, how long stuck, who burned them) → inject into dig+objection cards; teach the summarizer a per-rep-tailored ANCHORS section; offloads the rep's cognitive load (differentiator)
- [Dig card threading + natural transition](project_dig_card_threading.md) — ↓ threading (repeat-press = chunk down), exhaustion detection, belief SELECTION by natural transition. **QUEUED #6 (contained):** fix the `support`/`money-qualifier` dig NON-SEQUITURS — dig must anchor to the LATEST utterance, not probe a random open belief
- [Summarizer (Belief Ladder) tuning session](project_summarizer_tuning_session.md) — 🟢 SESSION-READY BRIEF: `tasks/plan-summarizer-tuning.md` (open it cold). CONFIRMED scope (Sebastian 2026-07-19): relabel ⚠️ "at-risk"→"objected", raise ✅ to EMOTIONAL ownership on Pain/Desire/Cost. Plus queued: close-readiness audit, money-resource capture, expand test-belief-ladder traps, A/B Sonnet 5 vs 4.6, cap #48. All eval-gated (`test-belief-ladder.mjs` GREEN) + plan-reviewer.
- [Positioning wedge — Offer-Aware vs Generic](project_positioning_wedge.md) — HIGH: generic-vs-offer-aware side-by-side of the SAME live moment = the demo that converts
- [Gutter-moment positioning (minute 18/34/41)](project_positioning_gutter_moments.md) — the core website/marketing narrative + the "why Wingman stays quiet" answer
- [Voice-AI onboarding discovery call](project_voice_ai_onboarding.md) — voice AI runs a chunk-down discovery on every user → auto-fills the Sales DNA page
- [Owner dashboard](project_owner_dashboard.md) — post-beta founder cockpit: revenue/churn + model registry (toggle model per slot); sits on #44 model-resilience
- [Dashboard solidity sweep](project_dashboard_solidity_sweep.md) — DEFERRED: final interaction pass to make the dashboard Granola-smooth
- [Calendar detection](project_calendar_detection.md) — Google Calendar meeting detection so Deploy "just works" without the Recall Space-swipe limit
- [Answer card build + kb-signal rename](project_answer_card_redesign.md) — QUEUED: build ← Answer as a direct general-LLM call (NOT KB — Answer isn't wired yet; KB block in kb-signal is dead code). Close (→) already DONE = the readiness chip (client-side, no KB). Rename legacy `kb-signal` route. FUTURE (engineer, deferred): proprietary-dataset upload → domain-specific Answer
- [Post-call flow redesign](project_post_call_flow.md) — ✅ BUILT 2026-07-24 S3 (local on `feat/confrontation-dial`, not pushed): call-end popups killed, Live Hub pill morphs Live→generating→"View call" + deep-link + skeleton + AI outcome auto-detect; ships in v0.1.29
- [Flight Recorder — dev-only full-call telemetry](project_flight_recorder.md) — 🟢 ACTIVE (spec in plan-review 2026-07-22): capture EVERYTHING a live call does (transcript + Deepgram partials + full card payloads/outputs + summarizer diffs + hallucination watch + card adoption + latency/cost) → `dev-logs/*.jsonl` (Claude reads) + a dev-only `/devlog` copy page. Feeds the voice grind. Spec: `tasks/plan-flight-recorder.md`. DEV-ONLY gated; must never affect the live call.

## Shipped Tools
- [Private changelog page](project_changelog_page.md) — owner-gated `/changelog`; `/wrap` auto-appends an entry each session. Shipped 2026-07-10 (PR #42)

## Sales DNA / Naming
- ["Offer Brain" rename is a phantom task](project_offer_brain_phantom.md) — term was never in app code; don't sweep/rename

## Tech Stack
Electron 40, Next.js 15, TypeScript, Supabase, Stripe, Recall.ai, Anthropic, OpenAI
