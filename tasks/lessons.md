
## Session: 2026-06-29

### Centralize model IDs + add a deprecation canary — a retired model silently broke a live feature
**What happened:** The Coach (`ai/chat/route.ts`) 502'd on every call because it was pinned to `claude-sonnet-4-20250514`, which Anthropic deprecated-with-notice and RETIRED ~June 15. Nobody noticed until Sebastian hit it on a live call — model IDs are scattered as string literals across ~6 routes and this one never moved to `claude-sonnet-4-6` when the others did.
**Rule:** Never scatter model IDs as literals. Keep ONE source of truth (`models.ts`) every route imports, and run a daily canary that checks each model via Anthropic's Models API (`GET /v1/models`) + alerts on deprecation. Models get months of notice + an email to the account owner — make sure that inbox is watched. When asked about any model/limit/deprecation, consult the claude-api skill (it caught that Sonnet 4.6's cache minimum is 2,048, not the 1,024 I'd misremembered).

### Verify an eval over MULTIPLE runs before trusting a delta — the AI judge is stochastic
**What happened:** A single eval run made anchors look like a clear win; another run made them look like a loss. Only running it 3× revealed the truth: the arms are tied within judge noise AND anchors carried a fabrication tail one run hid. I'd told Sebastian "anchors, zero downside" off too few runs and had to walk it back.
**Rule:** Never decide off one eval run when the grader is an LLM. Run N times, look at run-to-run variance, treat small composite deltas as noise. Lead with the honest read even when it corrects an earlier claim. For tonality, per-scenario reads + the human judge beat the aggregate.

## Session: 2026-06-15

### Label latency by its REAL component — don't call a number "search" when it's mostly a network embed
**What happened:** Told Sebastian PR #17 made "search ~10–20ms," but the `[kb-signal] TIMING search=` line swings between `0ms` and `~700ms`, and he rightly asked "which is it?" The `search=` number is actually **embedding (OpenAI) + the in-memory vector search**: the vector search IS ~20ms always, but embedding is ~500ms on a cache miss and 0ms on a 60s cache hit. By calling the whole thing "search" I made a clean win look inconsistent and confused him.
**Rule:** When reporting latency, name the *component* precisely and break a combined number into its parts (embed vs search vs generate). A figure like "search=505ms" must be explained as "embedding 483ms + memory search ~22ms," not presented as one opaque "search." Imprecise labeling makes a real win look like a bug.

### Before planning a heavy fix, confirm the target is actually the biggest cost — re-rank after every win
**What happened:** Sebastian was keen on self-hosting embeddings, so I wrote a heavy plan for it (re-embed the whole KB, swap the model). The plan-reviewer caught that **after PR #17, embedding is no longer the dominant press-to-card cost — generation (~1.5–2s) is, and the transcript lag makes cards *wrong*.** I was about to invest the most effort in the *3rd*-biggest lever.
**Rule:** Each time a fix lands, re-measure and re-rank the remaining costs before committing to the next build. Lead with the honest priority even when the founder is excited about a specific idea (CLAUDE.md: senior engineer pushes back). Fix the biggest/most-painful lever first — correctness (wrong card) and the dominant latency component beat a smaller speed win, regardless of which idea has momentum.

### Syntax-check generated code before handing it over — a builder that emits HTML/JS can ship a fatal typo
**What happened:** Built a blind grading page via a generator script (string-concatenated HTML/JS), opened it for Sebastian, and he got a black screen. Root cause: one innerHTML string opened with `'` but closed with `"` — a single mismatched quote that broke the entire `<script>`, so nothing rendered. I had the verification tooling (extract `<script>` → `node --check` / `new Function`) but only ran it AFTER he reported the failure.
**Rule:** Any time I generate code I can't watch render — especially HTML/JS emitted by a builder with quote-heavy string concatenation — run a syntax/runtime check on the OUTPUT before calling it ready. Cheap gate: pull the `<script>` and `node --check` it (or `new Function(js)` + a tiny DOM shim to execute it once). "The file wrote successfully" is not "it runs." Verify the artifact, not just that it was written.

## Session: 2026-06-05

### HUD HTML changes need a full electron:dev restart — and re-stage after EVERY edit
**What happened:** Fixed the disposition card's mouse capture in `electron/hud/index.html`, told Sebastian to restart, he tested — "didn't work." Root cause: the HUD HTML is not loaded from source. `wait-and-launch.js` (and `electron:compile`) COPY `electron/hud/` → `electron-dist/hud/` on launch, and `main.ts` loads `electron-dist/hud/index.html`. The running app had copied the file at an earlier restart, BEFORE my latest edit, so it silently ran the stale copy. Editing the source again does nothing until the next full launch re-copies it.
**Rule:** After ANY edit to `electron/hud/`, `electron/tray-popover/`, or any non-.ts asset the app loads from `electron-dist/`, the running app will NOT pick it up — there is no hot reload. (1) Tell Sebastian to fully quit (`Ctrl+C` in the electron:dev terminal — closing the window only hides the app) and re-run `npm run electron:dev`. (2) When iterating across multiple HUD edits in one conversation, proactively run `npm run electron:compile` after the LAST edit and verify with grep that `electron-dist/hud/index.html` contains the change, so the next restart is guaranteed to load it. Never assume a prior restart covers a later edit.

### Cost/economics estimates must be modeled at REAL usage scale, not test-fixture scale
**What happened:** Quoted the Sonnet summarizer at "~5–6¢/call" — but that was measured on tiny 3–4-tick test transcripts. Sebastian caught it: real 45–60 min calls have ~30–40 update ticks, so the true cost is ~44–59¢/call (~10×). My estimate was off by an order of magnitude because I extrapolated from a fixture, not from real usage.
**Rule:** Any per-call / per-unit / per-month cost estimate must be built from REAL operating parameters (real call length, real call volume, real tick/request count) — never from the scale of a quick test. State the assumptions inline (e.g. "45-min call = 30 ticks") so the math is auditable, and sanity-check the monthly total at the user's actual usage (here: 3–4 calls/day, not 40/mo) before presenting. A cost number without its usage assumptions is a trap.

### When an architecture decision changes mid-session, update the canonical doc IMMEDIATELY — not just in chat
**What happened:** We changed Phase 2 from "client-held / ephemeral summary" to "Sonnet + persist to `calls.live_summary`" in conversation, but the canonical Phase 2 design doc still said "Haiku" and implied ephemeral for a while. At wrap, a scan found the doc contradicting our own locked decisions — exactly the "stale plans leak into fresh sessions" risk.
**Rule:** The moment a decision changes how a system works, edit the canonical doc in the same turn (or the very next), not at session end. Verbal/chat agreement is not persistence — the next session reads the docs, not the transcript. Treat a decision as un-locked until its home doc reflects it.

## Session: 2026-04-13

### Self-review of plans has diminishing returns — use an adversarial subagent
**What happened:** Ran Plans A → B → C and declared Plan C production-grade. Sebastian challenged this. Ran an adversarial subagent whose only job was to break the plan. Found 24 issues — including 5 that would have caused silent production failures that neither of us would have caught without running and watching it break.
**Rule:** For any major architectural plan, spin up an adversarial subagent explicitly tasked to find holes — not validate. Never ask it "does this look good?" Always ask "what would break this?" Self-review is biased toward the plan you wrote. The adversarial agent has no such bias.

### Run batch ingestion at off-peak hours — 529s are time-of-day dependent
**What happened:** Started ingestion during US business hours. Anthropic's API returned 529 "overloaded" errors on nearly every Sonnet call. 30 out of 38 sources failed on the first run. Running early morning CST (7am) on the second run cleared almost all of them.
**Rule:** Any large batch job hitting Anthropic Sonnet should be scheduled for off-peak hours — before 8am CST or after midnight CST. Never start a large ingestion run during business hours.

### console.anthropic.com and claude.ai are completely separate — document both
**What happened:** Anthropic credits ran out mid-run. Sebastian went to top up and couldn't find the account — it was under a personal Gmail (sebmattiasperez@gmail.com), not his work email. He'd never set up console.anthropic.com consciously. Also accidentally bought $50 of claude.ai credits (chat interface) thinking it was the API console — they're completely separate billing systems.
**Rule:** At the start of any project using the Anthropic API, confirm which email the console.anthropic.com account is under and document it. The API console and the Claude chat interface have zero billing relationship. Adding credits to one does nothing for the other.

### Auto-reload threshold must be set high enough for the actual workload
**What happened:** Anthropic auto-reload was set to top off to $15 when balance hits $5. A batch ingestion run burned through credits faster than the reload triggered, causing a mid-run failure at video 30 of 38.
**Rule:** Before any large ingestion run, check the auto-reload threshold and set it to at least 3x the estimated run cost. For a ~$15 run, the threshold should be set to top off to $50.

### Always QA a sample of KB entries immediately after ingestion — before wiring into the live pipeline
**What happened:** After ingestion, Sebastian manually skimmed entries in Supabase and immediately found 3 categories of bad data: offer-specific scripts, third-person triggers, non-sales content. These would have fired garbage signal cards on real calls if we'd wired up the pipeline without reviewing.
**Rule:** After any KB ingestion (initial or re-ingestion), always QA at least 20-30 random entries in Supabase before enabling the KB in the live pipeline. Look specifically for: (1) exact_script containing offer-specific details, (2) prospect_triggers in third person, (3) entries that have nothing to do with live sales conversations.

### Prompt quality issues are invisible until you look at the actual data
**What happened:** The Pass 2 and Pass 3 prompts looked solid in review. The adversarial agent didn't catch the extraction quality problems. Only by looking at real extracted entries did we find that Sonnet was extracting personal productivity content, writing third-person triggers, and failing to flag offer-specific scripts.
**Rule:** You cannot fully evaluate an extraction prompt by reading it. You can only evaluate it by running it and reading the output. Always treat the first ingestion run as a prompt calibration exercise, not a final result.

### The --force flag re-processes ALL sources including already-completed ones — cost implication
**What happened:** Running `node ingest.js --force` re-processes all 38 sources regardless of status. The 8 that already succeeded were re-ingested on Run 2 and Run 3 unnecessarily. Small extra cost but adds up.
**Rule:** Consider whether a smarter skip logic is needed for large KB updates — e.g., only re-process sources that are status='failed' or that have been explicitly flagged for re-ingestion. The current --force behavior is correct for full re-architecture runs but wasteful for partial updates.

---

## Session: 2026-04-04

### Always check .gitignore before telling Sebastian to commit or push anything
**What happened:** Told Sebastian to commit and push the Wingman Brain files without checking `.gitignore` first. The folder was already excluded — the suggestion was unnecessary and wrong.
**Rule:** Before suggesting any `git add` or `git push`, check `.gitignore` to confirm what's actually tracked. Never assume a folder inside the project is committed just because it exists there.

---

## Session: 2026-04-03

### Always update WingmanBridge type when adding methods to preload.ts
**What happened:** Added `setZoomStatus` and `onNavigateToSettings` to `preload.ts` but forgot to add them to the `WingmanBridge` interface in `src/types/index.ts`. TypeScript compiled fine locally but Railway's production build failed with "Property 'onNavigateToSettings' does not exist on type 'WingmanBridge'." Caused a failed deployment.
**Rule:** Any time a new method is added to the `wingman` bridge in `preload.ts`, immediately add the matching type signature to `WingmanBridge` in `src/types/index.ts` in the same edit. These two files must always stay in sync.

### Pre-implementation bug review is worth doing — catches real problems before writing code
**What happened:** Before implementing the Zoom name warning feature across 5 files, did a full review of the proposed plan against the actual code. Found 3 real bugs: (1) race condition in zoom name tristate, (2) preload needed two additions not one, (3) tray height management missing. All were fixed before writing a line of code, not after.
**Rule:** For any multi-file feature, read ALL the files it touches before writing code. Run through the review checklist mentally. Real bugs are easier to fix in the plan than in the code.

### Recall AI API format can change silently — always read the error body
**What happened:** Every call start was failing with the stage bar appearing then immediately disappearing. Root cause was Recall AI changed `deepgram` to `deepgram_streaming` in their API. The error was clearly in the terminal: `400 {"non_field_errors":["Must provide exactly one of: deepgram_streaming, ..."]}` — but it wasn't visible until we checked the terminal logs.
**Rule:** When a call fails to start and the HUD disappears after <1 second, always check the terminal for `[Recall AI]` lines immediately. The error body from external APIs always tells you exactly what's wrong.

---

## Session: 2026-04-01

### Never make multi-file changes without showing a plan and getting explicit approval
**What happened:** Made changes across keyword-triggers.ts and useWingmanPoller.ts without presenting a plan first and waiting for Sebastian's "yes."
**Rule:** Any change touching more than 1 file requires writing the plan out first, showing it to Sebastian, and waiting for explicit approval before writing a single line of code. No exceptions, even if the fix seems obvious.

---

## Session: 2026-03-17

### npm version patch requires a completely clean git working directory
**What happened:** `npm version patch` failed with "Git working directory not clean" because modified files (`.claude/launch.json`, `CLAUDE.md`, etc.) weren't committed.
**Rule:** Before running `npm version patch`, always run `git add -A && git commit -m "..."` first to commit ALL pending changes, not just the files you touched.

### Always add .claude/launch.json to git when modified
**What happened:** Added a new preview server to `.claude/launch.json` but didn't include it in the `git add` command, causing the working directory to be dirty.
**Rule:** When modifying `.claude/launch.json`, include it in the commit explicitly.

### On Railway (proxy), `request.url` origin is the container's internal address, not the public host
**What happened:** After Google login on production web, users landed on `https://localhost:8080/dashboard`. `src/app/auth/callback/route.ts` built its post-login redirect from `new URL(request.url).origin`, which behind Railway's proxy is the container's internal `http://localhost:8080` — not `https://app.meetwingman.ai`. Broken for OAuth, magic links, password reset, and email confirmation since launch; unnoticed because the desktop app uses password login (client-side redirect). Supabase config was correct — this was our code.
**Rule:** In any server route handler that redirects to an absolute URL, derive the public origin from the proxy headers (`x-forwarded-host` / `x-forwarded-proto`), not from `request.url`. Use the shared `getPublicOrigin(request)` in `src/lib/auth/public-origin.ts`. The tell for this class of bug: a redirect that lands on `localhost:8080` **with a real app path** (`/dashboard`) appended — that path comes from our code, so the origin is the culprit, not Supabase.

### Queued future work belongs in Current Sprint.md, not just MEMORY's "Future Projects"
**What happened:** Captured a future design session (dig-card threading) as a MEMORY.md "Future Projects" pointer. Sebastian pushed back: "I don't think Claude checks Future Projects when I start new sessions." Correct — the session-start protocol reliably reads `Current Sprint.md` / `Known Issues.md` / `Decisions Log.md` and reports from them; MEMORY.md is auto-loaded but Future Projects is a low-salience backwater that doesn't drive "what do we work on."
**Rule:** For anything meant to shape a FUTURE session's work, add it to the `Current Sprint.md` QUEUED list (that's the file the start-of-session routine acts on), AND keep the MEMORY pointer as the durable cross-session index. Both — Current Sprint for reliable surfacing, MEMORY for permanence. A design note in `_Inbox/` alone is not enough; nothing routinely reads `_Inbox/`.
