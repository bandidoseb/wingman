# Current Sprint

Last updated: 2026-06-15

This is the first file Claude reads at session start. It answers: where are we, what's next, and what's blocking us.

---

## 🎯 NEXT SESSION — START HERE (written 2026-06-15, Sebastian in Monaco ~1h/day for 10 days)

**Where we are:** Press-to-card latency. PR #17 (in-memory KB search) is MERGED + deployed — it killed the 2.8s DB search (now `path=mem`, ~20ms). Migration 009 (fast HNSW fallback) is run in Supabase. Full session narrative in `2026-06-15.md`.

**The remaining press-to-card budget (post-PR-17):**
- Card generation (Haiku) ~1.5–2s ← biggest; fixed by **streaming**
- Transcript lag 1–3s ← makes cards *wrong* (fires for the PREVIOUS objection); fixed by **partials**
- Embedding ~0.2–0.5s ← smallest; fixed by **self-host** (last)

**THE NEXT TASK = the partials measurement (Step 1 of the transcript fix).** A DIAGNOSTIC build, light lift:
1. In `electron/recall.ts`, subscribe to Recall's `transcript.partial_data` events alongside the existing `transcript.data` (finals). Provider config lives where recording starts (check the `recall-upload-token` route / `startRecording` — Recall passes provider config there). Stay on **Deepgram** (already our provider, lowest-latency).
2. Log partials AND finals side-by-side with timestamps, so we can SEE on one real call: how much do the last 1–2 words churn between a partial and the final, and how fast do they settle?
3. Sebastian runs ONE short real call (`npm run electron:dev` + Zoom). Then decide: partials safe as-is / need a "trust a word once 2 partials agree" stabilize rule / or just tune Deepgram endpointing for faster *finals*.
- **WHY measure first:** Groq distills (cleans) the transcript before embedding so gist detection is robust — BUT it can't recover a genuinely-wrong word ("custom"→"customers"), and a rep won't re-press a bad card (they'll think it's trash). "Right the first time" is the bar; don't bet on an assumption about Deepgram's churn. Build design: finals = authoritative buffer, partials = provisional tail reconciled on final.

**Then, in order:**
- **Streaming card reveal (PR 2)** — GATED on a 1-hour Railway SSE-buffering spike (does Railway flush chunks incrementally or buffer them? If it buffers, PR 2 is dead — attack generation another way). Reviewer's PR 2 blockers are captured in `tasks/todo.md` (keep all 3 generators on JSON; per-chunk + hard-ceiling timeouts + HUD watchdog; IPC delta channel wired both sides in one commit per the #39 lesson).
- **Self-host embeddings (last)** — hardened plan in `tasks/plan-selfhost-embeddings.md`. Starts with a Phase 0 Railway spike (prove model-load mechanism + latency on Railway's shared CPU, NOT a laptop) + a per-objection quality gate (re-embed needs validation — may not do well on OUR objections). Needs Sebastian's explicit yes on the schema migration + committing ~130MB model to the repo.

**Working docs:** `tasks/todo.md` = live roadmap + PR 2 reviewer fixes. `tasks/plan-selfhost-embeddings.md` = hardened self-host plan. `_Inbox/Future Build - Cross-User Objection Cache.md` = scale-era idea (deferred).

---

## What Was Just Completed (2026-06-15 — in-memory KB search SHIPPED + latency roadmap)

Full narrative in `2026-06-15.md`.

- **PR #17 MERGED → Railway deploying.** Live vector search moved from the Supabase RPC (~2.3s seq-scan, EXPLAIN ANALYZE = 2,091ms — the `DISTINCT ON … ORDER BY e.id, distance` shape can't use a vector index) into the Node server's **memory**: load all 6,554 trigger embeddings at boot, brute-force cosine in-process (~10–20ms, exact). RPC kept as a **circuit-breaker-guarded fallback**. New `kb-memory.ts` + `kb-memory-core.ts` + `instrumentation.ts`; `knowledge-search.ts` + `pipeline-warmup.ts` rewired.
- **Parity gate 14/14** vs the live RPC (shared sims within 1e-4, identical sets — only exact-tie reorderings from Issue #28/#29 duplicate triggers, tolerated). 20 new unit tests (59 total). `wingman-reviewer` APPROVED (2 should-fixes folded). **Live: `path=mem`, search 2.8s → ~20ms.**
- **Migration 009 run ✅** — HNSW index + filter-then-rank rewrite of `search_kb_by_trigger` (same signature). Fallback now 2,091ms → 330ms warm.
- **Discovered the stale-objection bug** (Recall/Deepgram 1–3s finalization lag → card fires for the previous objection). Logged as Known Issue #41. A *correctness* problem — why the partials fix is next, not embedding speed.
- **Decisions (2026-06-15):** in-memory over Pinecone; self-host embeddings over the cross-user cache (deferred to scale); armed-objection-listener REJECTED; sequencing partials → streaming → self-host.

---

## What Was Just Completed (2026-06-11 — Phase 3.5 BUILT + MERGED, PR #15)

Full narrative in `2026-06-11.md`.

- **Phase 3.5 went plan → build → review → dev-test → merge in one session** (`12bfaec`, CI + Security green, Railway deployed). The full scope: **Groq query distillation** (`query-distill.ts`, prompt locked 5/5 on a pre-registered answer key via `scripts/test-distill.mjs`), **honest nudge card** on empty presses (static-fallback guaranteed — never dead air, never a guess), **green pick-flash + action-specific thinking pill** with live seconds counter + error/coming-soon states (no press can end in silence — every path resolves), **pipeline warm-up at call start** + **`TIMING …branch= idleGap=` instrumentation**, and a "belief/pillar/scorecard"-word ban in all card text.
- **Root-cause find:** the 0.65 similarity threshold was guillotining real KB matches (natural paraphrases of classic objections score 0.60–0.65; noise ≤0.54) → distilled queries search at **0.60** (`DISTILLED_SIMILARITY_THRESHOLD` in the kb-signal route). Distilled-vs-raw on the 5 test transcripts: correct techniques on 3/4 vs **0/4 for raw**.
- **Sebastian's dev test: 12 presses, zero dead air, all branches correct.** Distill 227–486ms; fast presses **1,526–1,629ms (inside the 1.5–2s goal)**; 3/8 nudge timeouts → tuned same-session (60-tok cap + 800-char input, reviewer-approved). Groq dashboard spike explained (offline tuning harness, not presses); **scale plan logged** in Beta Tuning Parameters (paid tier before beta ≈ $10/mo @ 1K users; 429s already degrade gracefully).
- **New decisions logged (Decisions Log 2026-06-11):** provider resilience = **failover-only** — Anthropic direct primary → OpenRouter pinned to the SAME Haiku on Bedrock/Vertex as fallback; circuit breaker (own-traffic = primary signal, status.claude.com JSON = secondary/lagging); warm-up ping doubles as the health probe; **test per-press vs breaker vs both — pick by observed behavior**. Rejected: middleman-for-everything + per-press model bouncing. **HUD card streaming** captured (`_Inbox/2026-06-11 HUD card streaming idea.md`) — hard requirement: super-smooth constant-rate reveal; design together with resilience, after the live gate.
- `GROQ_API_KEY` documented in CLAUDE.md env list (confirmed present in Railway). `plan-reviewer` caught 3 blockers pre-build (all silent-failure/race holes + the prompt-cache-can't-engage catch); `wingman-reviewer` approved both diffs.

**Next:** the **3.5 live gate** — real role-play call on the deployed build: capture the warm `branch=kb` TIMING number, confirm nudge timeouts gone post-tune, no "belief" leaks on screen. Then the **diagnostics-strip PR** (#39 hudLog + DevTools auto-open), then plan the **resilience + streaming build** (one design, own Plan Review Loop).

---

## What Was Just Completed (2026-06-10 — #39 SOLVED + live-verified, PR #13 merged)

Full narrative in `2026-06-10.md`.

- **#39 root cause found and fixed.** Not a compass bug: a dead `window.hud.onSignalDismiss()` call (in the HUD since the **initial commit**, never exposed on the `hud` preload bridge) threw at load and killed every IPC registration below it — compass, auto-stop toast, 2h cap warning, stage-pill init. One deleted line un-broke all four. Found by **instrumenting every hop + auto-opening DevTools on the HUD** (it was un-inspectable before — that's why two prior static-analysis sessions came up empty). Machine-checked it was the only missing bridge method.
- **#40 fixed (found in re-test):** duplicate `@keyframes fadeOut` (outcome card's transform version, last-declared-wins) was yanking the compass + signal bubble up-left on dismiss → renamed `outcomeFadeOut`. Also fixed the HUD's 404'ing `Wingman.png` + hardened `electron:compile` (rm -rf before cp -r).
- **Live-verified by Sebastian on a real Zoom call ✅:** full checkpoint chain green, compass rendered + auto-faded, double-tap objection fired, end-of-call chain clean. `wingman-reviewer` approved 3×, CI + Security green → **PR #13 merged** (`115e341`). Diagnostics stay in through 3.5 (#38 work), strip after.
- **Decisions (logged 2026-06-10):** compass stays **bottom-left** (configurator idea captured in `_Inbox/`); pick feedback = **green flash → "thinking" pill** (builds inside the 3.5 indicator task).
- **#38 still has no warm number** (today's 6.6s sample was another dev cold-compile); the 0-KB-match → garbage fallback card Sebastian saw live-confirms the distillation quality-gate rationale.
- **Stale-note correction:** PR #10 was already merged before this session — the "PR #10 holds until #39" line below is obsolete.

**Next:** Phase 3.5 build — **Groq query distillation** (+ no-objection graceful nudge) + **"Wingman's thinking…" pill + green-flash pick feedback** (one HUD/IPC task) + **#38 warm-number capture → optimize** (1h prompt cache + session warm-up). Real-call test = the gate.

---

## What Was Just Completed (2026-06-09 — Phase 3 reviewed + hardened → PR #10; live-test findings)

Full narrative in `2026-06-09.md`.

- **Phase 3 was already built + committed + pushed by a parallel session** (`cc836b5`). Independently reviewed it (typecheck + 28 tests green; manual + `wingman-reviewer` fresh-context pass — teardown/IPC/buffer/cost all clean), then **hardened + opened PR #10** (commit `e890dc1`): always-two-tier cards, dropped the stale "Rapport" stage, capped `live_summary` (4k), and — the reviewer's catch — a **12s client fetch timeout** so a mid-call network drop can't brick the compass. Plus the **equal-arrows CSS** (all 4 identical, no dimming — Sebastian's call) and a faithful `tasks/compass-preview.html`.
- **Decisions (Decisions Log 2026-06-07):** 3.5 retrieval = **query distillation on Groq `llama-3.1-8b-instant`** (`GROQ_API_KEY` now in .env.local + Railway); **Option C (on-device) deferred**; **"thinking/oops" indicator bundled into 3.5.**
- **Live tests surfaced 2 real bugs (logged):** **#39 — the compass does NOT render** even on a single Up press (confirmed, not the double-tap flash); **#38 — ~7.4s latency** (search alone 4.8s, mostly cold start). Also **#37** — no autonomous code is firing, but 3 ghosts remain → Phase 5. (Two red herrings ruled out: a too-short call with no transcript, and a corrupted `.next` cache fixed by `rm -rf .next`.)

**Next:** Phase 3.5 — Groq distillation + the indicator + **fix compass render (#39)** + **latency (#38)**. PR #10 holds (no live users) until #39 is fixed or it's bundled with 3.5.

---

## What Was Just Completed (2026-06-06 — Phase 2 gate passed + Phase 3 design locked + token cap raised)

**Phase 2 is fully complete.** Sebastian ran a real live sales call with Wingman deployed. All systems worked end-to-end for the first time.

**Live call confirmed working:**
- Recall AI detected meeting, recording started ✅
- Transcript streaming: ~85 chunks, all 200 ✅
- Belief Ladder summarizer: 17 ticks, prompt caching engaged every tick ✅
- Auto-stop on meeting window close (`meeting_lost`) ✅
- Post-call job: debrief written, 4 objections processed, pillar coverage + stages saved ✅
- HUD outcome "Follow Up" saved ✅
- Cost: **$0.21 for a 31-min call** — confirmed in target range (~$0.40 for 60-min)

**Code change shipped (NOT yet on a branch/PR — goes into Phase 3 PR):**
- `BELIEF_LADDER_MAX_TOKENS` raised **400 → 600** in `src/lib/wingman/belief-ladder.ts`
- Reason: live logs showed consistent 397–400 output every tick → scorecard was hitting the ceiling and truncating (Weakest Link + Open Objections likely cut off)
- Cost impact: +~$0.05/call (negligible)

**New file created:**
- `Wingman Brain/Beta Tuning Parameters.md` — tracks adjustable beta dials (output cap, live buffer duration, summarizer cadence) with what to watch, code locations, and cost impact per change

**Phase 3 design decisions locked (bring these into the Phase 3 session):**
1. **Full Belief Ladder scorecard** (the `liveSummary` text, ~600 tok) → Haiku at press time. Replace the current 5-field `scorecard_snapshot` in `kb-signal` / `knowledge-signal.ts`.
2. **Live transcript buffer = 120 seconds** (raised from original 90s spec). Remove the `.slice(-500)` from `knowledge-signal.ts` — send the full 120s buffer as designed.
3. **Keep Haiku** for press-time cards. Fix context + prompts first; revisit model only if cards still feel off after real calls.
4. The two inputs to Haiku at press time are: (a) full scorecard = whole call history; (b) 120s live buffer = raw recency. They cover different time horizons — not duplication.

**Next:** Phase 3 — hotkey + 4-arrow compass + signal card generation (already in progress in a separate session).

---

## What Was Just Completed (2026-06-05 — Session 2: Phase 2 Step 1 SHIPPED + live-tested + Elapsed fix)

**Phase 2 Step 1 is built, live-tested, and MERGED to `main` (PR #8 → Railway auto-deploying).** Full narrative in `2026-06-05.md` (Session 2 section).

- **Belief Ladder summarizer wired into the live pipeline.** Three pieces: `src/lib/wingman/belief-ladder.ts` (new — locked Sonnet prompt + model + 400-tok cap), `src/app/api/wingman/summarize/route.ts` (new — auth → rate-limit → input caps → ownership → Sonnet w/ prompt caching → persists to `calls.live_summary`), and a **separate 120s timer + buffer** in `useWingmanPoller.ts` (independent of the 25s transcript save; `flushSummarize` on call end; exposes `liveSummary` for Phase 3). **Step 1 + Step 2 collapsed** — persistence is in the route from day one.
- **`wingman-reviewer` caught 3 real bugs, all fixed:** (1) no input-size cap → unbounded Sonnet cost → added 50K/10K caps; (2) no per-user rate limit on a paid endpoint → added 30s/user throttle; (3) summarize buffer dropped on call end (last ~2 min incl. the close never scored) → `flushSummarize` (force) wired into both end paths.
- **LIVE TEST ✅** (real call, dev mode): transcript pipeline works (`/transcript 200` ×5 — was never end-to-end tested before), summarizer fired (`[summarize] ✅ Cache hit: created=1183`), **prompt caching ENGAGED** (resolves the design-doc caveat), `calls.live_summary` populated. Short tech-setup call → scorecard correctly came back **all ⬜ open + "not a sales conversation yet"** — the model refused to hallucinate (the whole point of the Sonnet lock).
- **Elapsed fix:** `Elapsed:` was always blank (model never told the time). Fixed **server-side** from `call_date` (2 files, single source of truth, survives drop-resume). Harness re-run = no grading regression. Live `Xm` rendering confirms next real call.

**Next:** Phase 3 (new session) — hotkey + 4-arrow compass + objection slot. Phase 2's last gate = a real role-play call (needs Sebastian's Zoom time).

---

## What Was Just Completed (2026-06-05 — Phase 2 prompt-first + Sonnet lock + Call Continuity design + pricing tiers)

Big session. Full narrative in `2026-06-05.md`.

- **Bugs #35 + #36 RESOLVED** — disposition HUD card fixed (self-healing + hover-capture so it no longer freezes the whole screen + centered; live-tested by Sebastian ✅); double-end race confirmed already-guarded in committed code. `wingman-reviewer` approved twice.
- **Phase 2 prompt-first build + Sonnet LOCKED** — built the offline summarizer harness (`scripts/test-belief-ladder.mjs`) + a 5-trap test with a pre-registered answer key (`scripts/test-transcripts/EXPECTED.md`). **Sonnet 5/5 vs Haiku 2 slips** → summarizer = **Sonnet 4.6** (Haiku stays on the live press-time card). Cost corrected to ~44–59¢/call un-optimized → **~20–25¢ with locked levers**. Schema run: **`calls.live_summary` column is live.**
- **NEW track — Call Continuity + Prospect Memory** (`00 - Product/Call Continuity + Prospect Memory Design.md`): drop-resume = **CORE**, cross-call deal memory = **PREMIUM**; Recall calendar → prospect identity by **email**; prospect/deal pages + **next-call game plan**; **"Today's Calls"** briefing; deal-level Ask Wingman upsell. Never silently merge; expands compliance #33 (identified PII).
- **Pricing → tiers (PROPOSAL)** (`06 - Finance/Tier Pricing Proposal + Unit Economics.md`): Free 10 / **Core $149** (soft-capped ~75) / **Pro $299** (unlimited + premium). **Call-counting rule decided:** ≥10 min AND prospect spoke. Strategy research (YC/ICONIQ/Hormozi): build quality, fix margin in pricing.
- **Brain reconciled** — killed stale "delete transcripts," "flat $149 unlimited," "Haiku summarizer," and the retired "Free to fly" tagline across the vault; corrected this session's mis-date (06-03 → 06-05).

**Next:** Phase 2 Step 1 (summarize route + ~2-min timer + `belief-ladder.ts`), then persistence; then the continuity track; finalize pricing numbers.

---

## What Was Just Completed (2026-06-03 — Phase 1 shipped + Phase 2 designed)

**Phase 1 merged (PR #5)** and **Phase 2 fully designed + locked.** Full narrative in `2026-06-03.md`.

- **Phase 1 (live):** retired the live Sonnet poll, moved 6-stage derivation to the post-call job (writes `call_stages` — idempotent delete-then-insert + checked insert error), silenced ALL autonomous cards (ambient dot only, no pop-ups), hid the HUD stage bar. `wingman-reviewer` caught a real blocker pre-merge — `status: "incomplete"` violated the `call_stages` CHECK constraint and would have failed silently → switched to `"skipped"` + added insert-error logging. **Live-tested ✅** (ambient dot only; Stage Breakdown + Intel heatmap populated from post-call stages; transcript + debrief intact).
- **Phase 2 (designed, NOT built):** canonical spec `00 - Product/Phase 2 — Live Call Memory Design.md`. Scout CUT (timer-driven Belief Ladder summary instead); card = ONE Haiku call (summary + live 90s buffer + action) with "recent transcript overrides summary"; summary updater client-triggered (Vercel-safe); caching = 1h TTL + warm + keep-warm w/ a loud min-block-size verify caveat; speculative pre-gen deferred.
- **Decisions locked (Decisions Log, 2026-06-03):** (1) show 4 universal stages, coach the elite depth underneath; (2) Sales DNA personalizes CONTENT, never the framework standard; (3) post-call viz = gradient-colored labeled blocks + scatter reserved for a multi-call trend view.
- **2 tasks spawned:** disposition HUD bug (#35), double-end race (#36).
- **Confirmed:** Pusher migration is obsolete (hotkey removes server-push need — marked superseded); PostHog/Pinecone/Vercel orthogonal, no rebuild risk.

**Next:** Phase 2 build (serial — shared live-pipeline state). Consider clearing tasks #35/#36 first since they touch the same end-call paths.

---

## What Was Just Completed (2026-06-02 — Phase 0: Transcript Decouple)

**PR #4 merged** (`feat/phase0-transcript-decouple`). Live-tested ✅.

- **New `POST /api/wingman/transcript`** — saves `call_transcript` rows with zero AI cost (no Sonnet, no Pusher). Auth + call ownership check + same parse/insert logic as the poll route.
- **`useWingmanPoller.ts` rewired** — `executeTranscriptSave` added; timer now runs every 25s (fixed, was stage-dependent 8–90s); `flushBuffer` (called on call end) routes to the new endpoint. `POLL_INTERVALS` import removed. `executePoll` stays as dead code — Phase 1 removes it.
- **Live-tested** — transcript rows confirmed in Flight Log (exact spoken words), post-call debrief confirmed firing. Phase 0 acceptance criteria met.
- **Disposition HUD bug observed** (second call of session — buttons unresponsive, HUD auto-dismissed). Pre-existing issue, logged as Known Issue #35. Investigation task spawned.

**Next:** Phase 1 — stages → post-call; retire the live Sonnet poll.

---

## What Was Just Completed (2026-06-01 — Session 2: Hotkey Model Fully Specified)

Planning/strategy session — **no app code changed.** Produced the hardened, plan-reviewed implementation plan for the #1 build and locked several major product decisions. Working plan in `tasks/todo.md`; full narrative in today's build log (Session 2); decisions in Decisions Log (5 entries dated 2026-06-01).

- **"Offer Brain" investigation → item 0k is MOOT.** Verified 3 ways it was never in the app (full-repo grep + git history; 8 nav tabs; docs only). What Sebastian remembered = the Personalize tab. Nothing to rename; the "offer" strings are the literal offer feature. Saved to Claude memory. **Sales DNA tab deferred** to the real learning build (don't rename the manual Personalize form).
- **Hotkey model hardened to 6 phases.** `plan-reviewer` caught a CRITICAL hole: `/api/wingman/poll` is the ONLY writer of `call_transcript` — killing it first would have blanked every Flight Log/debrief/Ask-Wingman/Objection Vault. Resequenced so transcript persistence is decoupled FIRST. Stage derivation moves to post-call (keeps IntelTab); summoned cards bypass the 90s cooldown; Pusher dropped from the hot path.
- **The 4 arrows LOCKED:** ↑ objection · ← answer · ↓ dig deeper · → close. Eyes-free directional pad; silent fade dismiss; Up Arrow default + Settings override (same phase). Research-backed for the high-ticket info-product niche.
- **Live call memory = rolling Cole Gordon Belief Ladder scorecard** (his 7 Beliefs ≈ our 7 pillars). Read his training docs in full to design the template. Every arrow reasons over the whole call cheaply (~few cents/call).
- **Right arrow = readiness-aware 3-state close** (🟢 close now / 🟡 lock the gap / 🔴 too early — color + state + the move). Bakes in "what am I missing?" for free.

---

## What Was Just Completed (2026-06-01 — Dev Harness + CI/PR Workflow)

Built the *factory* before the build sprint (full detail in `2026-06-01.md`). No app feature code changed.

- **Dev harness merged (PR #1):** `wingman-reviewer` + `plan-reviewer` subagents (Review Checklist moved out of CLAUDE.md), a Stop hook that blocks ending a coding turn unless `tsc` (web+electron) + `npm test` pass, a PreToolUse hook that blocks `.env` edits, and **Vitest + 28 unit tests** on pure logic.
- **Branch → PR → review → merge workflow adopted.** CI + Security Review GitHub Actions run on every PR. Branch protection active on `main` (require PR, require `checks`, up-to-date branches, block force pushes). `ANTHROPIC_API_KEY` secret added.
- **Security:** rotated an exposed GitHub PAT, moved to tokenless remote + keychain, fixed `gh` to the `bandidoseb` account.
- **Researched** state-of-the-art Claude Code workflows (Boris Cherny / Anthropic team methods) and applied them to the harness.

> ⚠️ **The harness only activates on a fresh Claude Code session.** Restart Claude Code before the next build so the hooks + reviewer agents are live.

---

## What Was Just Completed (2026-05-31 — Strategy Session: Hotkey Pivot, Sales DNA, Pricing)

This was a **decisions/logging session — no app code changed, nothing pushed.** Three major decisions made and fully logged in `Decisions Log.md` (2026-05-31 entries) with enough build context to pick up cold:

- **MAJOR PIVOT — signal cards become hotkey-summoned, not autonomous.** Rep presses a hotkey (default: **Up Arrow**, captured only during live calls, changeable in Settings) → fixed menu of options → Wingman generates the card for the picked option. Kills autonomous pop-ups (distraction + "knows better than the rep" problem). The keyword classifier is **demoted from card-launcher to silent scout** (tags context, never fires). Menu is always visually identical (no greying). Visible **stage bar removed** → ambient presence dot. **Live Sonnet stage polling killed** → stage analysis moves to post-call. Generation = cheapest version first (generate-on-pick). Cost model: **$0 continuous** (buffering + keyword matching, no embeddings), pay only on keypress. Full spec + file map + open questions in Decisions Log. **Not built yet — needs its own Plan Review Loop before touching the live pipeline.**
- **"Offer Brain" renamed to "Sales DNA."** CLAUDE.md + Wingman skill doc updated this session. **Code + app-wide rename sweep still pending — see What's Next.**
- **Pricing locked directionally:** 10 free calls → $149/mo, **unlimited, no cap** (price is the margin lever, not caps). The hotkey pivot's near-zero live AI cost is what makes unlimited affordable. Old "free to fly, pay when you win" model is dead.

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

## What Was Just Completed (2026-05-30 — Strategy + Architecture Session)

- **Groq research completed** — 2026 benchmarks confirm: stay on Claude Haiku 4.5. Groq TTFT too high for 30-token outputs. Quality gap confirmed via Arena Elo (Claude 1,404 vs best open-source ~1,380). Cost delta <$1/day at current scale. Revisit post-beta.
- **Prompt caching gap identified** — `knowledge-signal.ts` has zero caching. Added as item 0i: 1-hour TTL cache + session warm-up at call start. Ready to build.
- **Pinecone migration decided** — moving from pgvector to Pinecone before beta. "Build for the future, not for demos." Plan scoped. Blocked on: Sebastian creates Pinecone account + index (dim 1536, cosine) + API key.
- **Architecture visuals built** — 4 HTML files in `tasks/`: `wingman-data-flow.html`, `wingman-architecture.html`, `wingman-investor-visual.html`, `wingman-deep-dive.html`. Investor-ready.
- **Pre-beta audit framed** — honest assessment of what's solid vs. what needs fixing before real users.
- **Pusher status clarified** — built April 26, never tested on a real call. Still needs live test.

---

## What Was Just Completed (2026-04-26 — Pusher WebSocket Push Migration)

- **Background Haiku KB scan removed (#0a)** — `useWingmanPoller.ts` no longer runs KB search every 10 seconds. Only fires on keyword trigger hits. Saves $0.41/call.
- **Pusher migration fully built (#0b)** — 7 steps complete: `pusher` + `pusher-js` installed, `src/lib/pusher.ts` singleton created, `/api/pusher/auth` private channel auth endpoint built, `poll/route.ts` and `kb-signal/route.ts` now push via Pusher and return `{ ok: true }`, `useWingmanPoller.ts` subscribes to Pusher channel and handles both event types, Railway env vars added. TypeScript-clean (`npx tsc --noEmit` = zero errors). Cost: $1.98 → $0.37/call (81% reduction). Latency: up to 90s delay → instant.
- **NOT YET TESTED** — Electron dev window is stuck on blank `/onboarding` page. Fix before testing: Supabase → profiles → set `onboarding_completed = true` → save. Then in Electron DevTools console: `window.location.assign('http://localhost:3000/dashboard')`.

---

## What's In Progress

- Nothing mid-flight in code. **Phase 3.5 is merged + deployed; its live gate (a real role-play call) is the first task of the next session.** That one call closes three things at once: the Phase 2 ladder-climb watch, the 3.5 acceptance script, and the #38 warm `branch=kb` number.

---

## What's Next (Priority Order)

**🎯 HOTKEY SIGNAL-CARD MODEL — progress: Phase 0 ✅ · Phase 1 ✅ · #35/#36 ✅ · Phase 2 ✅ (PR #8) · Phase 3 ✅ (PR #10) · #39/#40 ✅ (PR #13) · Phase 3.5 ✅ MERGED (PR #15, 2026-06-11 — live gate pending)** → next in track: **the live gate**, then the diagnostics-strip PR, then **resilience + streaming build** (Decisions Log 2026-06-11 + `_Inbox/2026-06-11 HUD card streaming idea.md` — needs Sebastian's OpenRouter account), then Phase 4 (← ↓ → arrows) · Phase 5 (dead-code cleanup + #34/#37). Phased plan in `tasks/todo.md` + `00 - Product/Hotkey Model Build Plan.md`. Build serially (shared live-pipeline state). Gate to "done" each phase = live test on a real call (only Sebastian).

  - **✅ Phase 0 (shipped):** transcript persistence decoupled to `/api/wingman/transcript`.
  - **✅ Phase 1 (shipped):** retired the Sonnet poll, stages → post-call, silenced autonomous cards, hid stage bar.
  - **✅ #35 + #36 (resolved 2026-06-05):** disposition HUD card + double-end race — the end-call paths Phase 2 builds on are now solid.
  - **✅ Phase 2 (merged + deployed 2026-06-05 S2, PR #8):** the rolling Belief Ladder live-call memory. Spec: `00 - Product/Phase 2 — Live Call Memory Design.md`. Built `belief-ladder.ts` (locked Sonnet prompt) + `POST /api/wingman/summarize` (rate-limited, input-capped, prompt-cached, persists to `calls.live_summary`) + a separate 120s timer/buffer + `flushSummarize` in `useWingmanPoller.ts`. `wingman-reviewer` caught 3 cost/correctness bugs (input cap, rate limit, end-of-call flush) — all fixed. Live test confirmed: transcript pipeline works, summarizer fires, **caching engaged**, DB persists, model stays honest on an empty call. Elapsed fixed server-side from `call_date`. **Last gate:** a real role-play call to watch the ladder fill over a full conversation (needs Zoom time).
  - **🆕 PARALLEL TRACK — Call Continuity + Prospect Memory** (`00 - Product/Call Continuity + Prospect Memory Design.md`): drop-resume (CORE) → calendar + cross-call prospect memory (PREMIUM). Phases A–D; each needs its own schema migration (prospects table, prospect_id, calendar_connections) — show SQL + get approval per phase. Sequence after / alongside the hotkey track (shared live pipeline → likely serial).
  - **Phase 3:** hotkey + 4-arrow compass menu + objection slot (highest risk, the milestone) + Settings hotkey override (`profiles.call_hotkey` — show SQL first).
  - **Phase 4:** the other 3 arrows (← answer · ↓ dig · → close readiness hue).
  - **Phase 5:** dead-code removal (`/poll` route, `POLL_INTERVALS`, unused components), reconcile CLAUDE.md Core Product Rules (Issue #34).
  - **Sales DNA** (the real per-user learning JSON — doesn't exist yet, `rep-profile.ts` only assembles call stats) remains the coupled core after the hotkey UI lands. Rule locked 2026-06-03: DNA personalizes CONTENT, never the framework standard.

0k. 🏷️ **App + code-wide rename: "Offer Brain" → "Sales DNA"** — The term is renamed product-wide (decision 2026-05-31). CLAUDE.md and the Wingman skill doc are already updated. **Everything else still says "Offer Brain" and must be changed:**
  - **User-facing copy first** (highest priority — Sebastian confirmed it shows on the dashboard app): every place the UI says "Offer Brain" → "Sales DNA". Sweep `src/components/dashboard/` (Settings, Home, Intel tabs, reset flow), onboarding components, and any paywall/marketing copy.
  - **Code identifiers (second, lower urgency — can be its own session):** `src/lib/wingman/rep-profile.ts` (the loader), DB column(s) storing the JSON, JSON keys, TypeScript types in `src/types/index.ts`, API routes referencing it, the post-call job's delta-update logic. A careless code-wide rename can break the live pipeline — do it deliberately with `npx tsc --noEmit` verification, and treat the DB column rename as a schema change (needs Sebastian's explicit yes + a migration).
  - **Approach:** do the user-facing copy sweep as one task, the code/DB rename as a separate approved task. Verify zero stray "Offer Brain" / "offer_brain" references remain at the end of each (`grep -ri "offer brain\|offer_brain" src/ electron/`).

0j. 🗄️ **Pinecone migration** — Replace pgvector with Pinecone for all vector search. One index (`wingman-kb`), two namespaces (`signal-triggers` + `coaching`). Files: `knowledge-search.ts`, new `knowledge-base/pinecone-migrate.js`, `knowledge-base/ingest.js`, `package.json`. **BLOCKED ON:** Sebastian creates Pinecone account → index named `wingman-kb` (dimension 1536, metric cosine) → provides API key. Then ready to build immediately.

0i. ⚡ **Prompt caching upgrade — 1-hour cache + session warm-up** — Two-file change. (1) Add `cache_control: { type: "ephemeral", ttl: "1h" }` to `src/lib/wingman/knowledge-signal.ts` on the system prompt — currently has zero caching. (2) Add a background cache warm-up call to `src/app/api/wingman/session/route.ts` that fires at call start, sends the system prompt + Offer Brain to Claude so the cache is hot before the first signal card trigger lands. Cost impact: 90% reduction on cached tokens for every signal card after the first. Latency impact: first signal card is now fast too (warm cache). Two files, low risk. Do this before JEPA upgrades.

0h. 🧠 **JEPA Intelligence Upgrades — 3 AI improvements (cost + quality + efficiency)** — Derived from Yann LeCun's JEPA research. These three changes will lower AI inference costs, improve signal card accuracy, and make Wingman smarter about what's coming next on a call. Full spec: `00 - Product/JEPA Intelligence Upgrades.md`.
  1. **Semantic embedding trigger detection** — replace `keyword-triggers.ts` pattern matching with cosine similarity against objection prototype embeddings. Catches paraphrased objections keyword matching misses entirely.
  2. **Token redundancy reduction** — strip filler words from transcript chunks before sending to Claude, and deduplicate content that appears in both system prompt and Offer Brain. Direct ~10–15% reduction on every inference call.
  3. **Session memory as lightweight next-state predictor** — track stage + last 2–3 prospect responses and use that to pre-warm the KB search before the objection lands. Turns reactive RAG into predictive RAG.

  > Revisit this after Pusher is tested live and stable (item 0b). Do not attempt these three in the same session as each other.

---

0. 🚨 **Build `/terms` and `/privacy` pages on meetwingman.ai** — P0 before any public beta user signs up. The signup ToS line links to `/terms` — that URL must resolve. Copy direction in `Wingman Brain/03 - GTM/Website Plan.md`. Issue #33 basic posture is now set; these pages are the remaining compliance blocker.

0a. ✅ **Quick win: eliminate background Haiku KB scan** — DONE. Removed 2026-04-26.

0b. ⚠️ **WebSocket push migration (Pusher)** — SUPERSEDED 2026-06-02. The hotkey pivot removes the need for server-pushed cards (summoned cards return synchronously in the `/kb-signal` response). Do NOT test/finish Pusher — the hotkey phases remove it (Phase 5 rips out the leftover path). See `05 - Operations/WebSocket Push Migration Plan.md` (marked obsolete).

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
