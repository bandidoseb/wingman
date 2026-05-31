# CLAUDE.md — Wingman AI Sales Copilot

Read this entire file before doing anything. This is the source of truth for the Wingman project.

---

## What Is Wingman

Wingman is a Mac desktop app (Electron + Next.js) that acts as a real-time AI copilot during high-ticket sales calls. It listens live, detects crucial moments, and surfaces a "signal card" on screen — the exact thing to say — in under 1 second. Invisible to the prospect.

**Builder:** Sebastian. Non-technical. Always give exact terminal commands. Never assume coding knowledge. Never use jargon without explaining it.

**Repo:** bandidoseb/wingman  
**Local path:** `/Users/sebastianperez/Desktop/Wingman CC`  
**Deployed via:** Railway (web/backend auto-deploys on git push). Desktop app needs a release cut.  
**Current version:** 0.1.19

---

## System Requirements (IMPORTANT — affects marketing / website copy)

**Wingman only works on Apple Silicon Macs.** This is a hard constraint from the Recall AI Desktop SDK.

| Requirement | Details |
|-------------|---------|
| **Mac chip** | Apple Silicon only — M1, M2, M3 (and later). Intel Macs (pre-2020) are NOT supported. |
| **macOS version** | macOS 13 Ventura or later |
| **Supported meeting apps** | Zoom, Microsoft Teams, Google Meet (Chrome browser) |
| **Not supported** | Intel Macs, Windows, Linux, other meeting apps |

**Why Intel Macs won't work:** The Recall AI Desktop SDK uses native macOS binaries compiled for Apple Silicon only. There is no Intel (x86) build. This is a Recall AI constraint — not something Wingman can work around.

**For the website:** Must be clearly stated in system requirements. Suggested copy: *"Requires a Mac with Apple Silicon (M1, M2, or M3 chip). macOS 13 or later. Compatible with Zoom, Microsoft Teams, and Google Meet."*

**Note on notarization:** The current build is not Apple-notarized (code-signing). When users download a non-notarized app, macOS shows a warning. Workaround for beta testers:
```bash
xattr -dr com.apple.quarantine "/Applications/Wingman.app"
```
This must be run in Terminal after moving the app to /Applications. We should document this in the beta onboarding email.

---

## Tech Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Desktop app | Electron (TypeScript) | Mac app shell + floating HUD overlay |
| Web/dashboard | Next.js (App Router) | Dashboard UI, API routes, auth |
| Live audio | Recall.ai | Joins the call, streams transcript |
| Transcription | Deepgram (inside Recall.ai) | Speech to text |
| AI — live | Claude Haiku | Signal card generation, target <1 second |
| AI — post-call | Claude Sonnet | Call grading, debrief, Sales DNA update |
| Database | Supabase | Users, calls, Sales DNA JSON, KB embeddings |
| Vector search | pgvector (in Supabase) | RAG knowledge base retrieval |
| Hosting | Railway | Backend API |
| Billing | Stripe | Subscription (routes exist, not fully wired) |
| iMessage | Project Blue / Blooio | Conversion funnel (not built yet) |
| KB ingestion | Custom Node.js tool | YouTube → transcript → KB entries → embeddings |

---

## Project Structure

```
/Wingman CC
├── electron/                  # Desktop app (Electron)
│   ├── main.ts                # Main process — app lifecycle, tray, HUD window
│   ├── preload.ts             # Bridge between Electron and web UI
│   ├── recall.ts              # Recall.ai integration — live transcript stream
│   ├── hud/index.html         # Floating HUD overlay (signal cards, stage bar)
│   └── tray-popover/index.html # Tray menu UI
│
├── src/                       # Next.js web app (dashboard + API)
│   ├── app/
│   │   ├── (auth)/            # Login, signup pages
│   │   ├── (dashboard)/       # Main dashboard (DashboardClient.tsx, HomeTab, etc.)
│   │   └── api/
│   │       ├── wingman/
│   │       │   ├── session/   # Start/end call session
│   │       │   ├── poll/      # HUD polls this for signal cards
│   │       │   ├── kb-signal/ # RAG lookup → signal card generation
│   │       │   ├── post-call/ # Post-call AI job (grade, debrief, Sales DNA)
│   │       │   └── outcome/   # User marks call outcome (Closed/Lost/DQ/etc.)
│   │       ├── ai/chat/       # "Ask Wingman" chatbot (per-call transcript chat)
│   │       ├── calls/         # Call records CRUD
│   │       ├── objections/    # Objection vault data
│   │       ├── signals/       # Signal card history
│   │       ├── stripe/        # Checkout, customer portal, webhook
│   │       ├── profile/       # User profile updates
│   │       ├── onboarding/    # Onboarding completion
│   │       └── user/          # User data
│   │
│   ├── components/
│   │   ├── dashboard/         # FlightLogTab, HomeTab, IntelTab, ObjectionVaultTab, SettingsTab, Sidebar, PlaybookTab (SignalVaultTab retired)
│   │   ├── wingman/           # LiveCallView, SignalCard, SignalLog, StageBar, LiveScorecard
│   │   ├── onboarding/        # Multi-step onboarding flow components
│   │   └── ui/                # Shared UI primitives
│   │
│   ├── lib/
│   │   ├── wingman/
│   │   │   ├── knowledge-search.ts   # Vector search against KB
│   │   │   ├── knowledge-signal.ts   # Assembles prompt + calls Claude Haiku
│   │   │   ├── keyword-triggers.ts   # Fast trigger classifier (fires before RAG)
│   │   │   ├── system-prompt.ts      # Claude system prompt assembly
│   │   │   ├── rep-profile.ts        # Sales DNA loader
│   │   │   └── poll-intervals.ts     # HUD polling config
│   │   └── supabase/                 # Supabase client (client, server, middleware)
│   │
│   └── hooks/
│       ├── useRecallTranscript.ts    # Hooks into Recall.ai transcript stream
│       └── useWingmanPoller.ts       # HUD polling hook
│
├── knowledge-base/            # Standalone KB ingestion tool (Node.js)
│   ├── ingest.js              # YouTube → transcript → KB entries → embeddings
│   ├── server.js              # Local server for KB management UI
│   └── public/index.html      # KB management UI
│
├── supabase/migrations/       # Database schema history
├── scripts/                   # Build + release scripts
├── electron-builder.yml       # Desktop app build config
├── .github/workflows/         # GitHub Actions — auto-builds .dmg on release
├── .env.local                 # API keys and secrets (NEVER touch, NEVER commit)
└── .claude/                   # Claude Code settings
```

---

## Current Build Status (as of March 2026)

### ✅ Built / working (with confidence levels)
- HUD shows up on screen ✅
- Signal card UI renders on screen (~80% confident)
- Supabase connected (~90% confident)
- Post-call job + Sales DNA updating (~98% confident)
- Flight Log screen ✅ — includes inline outcome picker, call chat, post-call debrief
- Mission Intel modal ✅ — staggered multi-bubble chat, daily cap, KB-powered coaching
- Objection Vault tab ✅ — only populated from real calls, no pre-seeded data
- Onboarding flow (multi-step) ✅
- Auth (login/signup) ✅
- Post-call HUD outcome card ✅ — "How'd it go?" card fires after call ends, saves via Bearer token
- Stripe routes exist (checkout, webhook, portal) — not fully wired/tested
- Knowledge base: 37 videos, ~15 hours, 419 KB entries ingested ✅
- Recall AI SDK initializes and detects Zoom meetings ✅ (confirmed working as of v0.1.19)
- Recall AI upload token flow ✅ — API key lives on Railway, Electron fetches short-lived token via authenticated API route

### ❌ Broken / not connected
- **Deploy Wingman button** — meeting detection confirmed working, full live transcript pipeline NOT yet end-to-end tested. #1 priority before beta.
- End-to-end transcript → signal card pipeline has NOT been tested live
- Stripe billing — not live
- iMessage upsell trigger — not built yet

### 🔲 Not built yet
- **Playbook page** — pre-call framework setup (replaces Signal Vault, see below)
- Stripe billing fully wired
- iMessage upsell trigger (Project Blue / Blooio)
- Windows support (Mac only for now)

### 🗑️ Retired
- **Signal Vault tab** — removed from sidebar. Replaced by: (1) Playbook page for pre-call framework setup, (2) post-call framework review inside individual Flight Log entries.

---

## Definition of Done (V1 Beta)

A user can:
1. Open Wingman and click Deploy
2. Wingman listens live on their sales call
3. Signal cards pop up at the right moments (objections, key triggers) — rare, powerful, not spammy
4. Stage bar tracks them through the call stages
5. Call ends → "How'd it go?" HUD card fires → rep logs outcome instantly
6. Post-call job fires automatically
7. User goes to dashboard → sees Flight Log entry with transcript, debrief, grade, framework coverage
8. User can chat with "Ask Wingman" (Mission Intel) about any call
9. Objections from the call appear in their Objection Vault
10. Sales DNA updates silently in the background
11. Rep can set up their Playbook framework once → Wingman uses it silently every call

**That's the finish line. Everything else is V2.**

---

## Core Product Rules (Never Violate)

1. **One signal card at a time. Never queue.**
2. **90-second minimum cooldown between signal cards.**
3. **Almost nothing fires during Rapport stage.**
4. **Signal cards only fire when silence would cost money.** If it's not a clear yes — don't fire.
5. **Signal cards use the prospect's exact words** (tie-down language).
6. **Raw transcripts are deleted immediately** after post-call job runs. Never stored long-term.
7. **Never store audio or video.** Text only.
8. **Post-call job never runs during a live call.** Always async.
9. **Sales DNA updates silently.** User never configures it manually.
10. **Wingman is bowling alley bumpers — not a script.** It only activates when a rep is about to go in the gutter. It does NOT tell reps what to say on every exchange. Reps that sound like they're reading AI suggestions are a product failure. Signal cards should be rare, surgical, and feel like intuition — not instructions.
11. **Never make reps into robots.** If a feature would cause a rep to sound scripted, unnatural, or disconnected from the prospect — don't build it. The highest-performing closers in the industry will judge this product harshly if it produces robotic behavior. That reputation damage kills the business.

---

## AI Architecture (RAG Pipeline)

```
Recall.ai transcript stream
         ↓
Keyword trigger classifier (keyword-triggers.ts) — fast, cheap
         ↓ (only fires on meaningful moments)
Embed trigger chunk → pgvector search → Sales KB (knowledge-search.ts)
         ↓
Prompt assembly: system prompt + Sales DNA + session memory + KB results + trigger chunk
         ↓
Claude Haiku → signal card → HUD (target: <1 second)
         ↓
[Call ends]
         ↓
Post-call job (Claude Sonnet) — async:
  Grade + debrief + one win + one fix + objections + Sales DNA delta
         ↓
Sales DNA JSON updated in Supabase
Flight Log entry created
Raw transcript deleted
```

---

## Sales DNA

*(Renamed from "Offer Brain" on 2026-05-31 — same system, more neutral/personal name. A full app + code-wide rename sweep is still pending; see `Wingman Brain/01 - Build Log/Current Sprint.md`. Old code identifiers like `rep-profile.ts` and DB columns may still say "offer_brain" until that sweep runs.)*

One JSON object per user stored in Supabase. Loads at call start. Updated after every call by post-call job.

Stores: offer details, prospect archetypes, top objections + what handled them, price reveal patterns, average close timing.

Rules: One active Sales DNA per user. Never let the user manually configure it. Reset button exists (with warning). This is the product's #1 moat and switching cost.

---

## Call Stages (8-Stage Framework)

Built on Jeremy Miner (NEPQ) + Cole Gordon methodology. This is the default Wingman Playbook framework.

1. **Rapport / Tonality** — Establish peer frame, not salesperson frame. Slow down, match energy. Almost no signals fire here.
2. **Pre-frame / Agenda** — Tell them how the call works. Get permission to ask questions. Kills objections early.
3. **Situation** — Fact-find. Current state, context, what they've tried. Logical setup for pain questions.
4. **Pain / Problem** — NEPQ questions: dig into real problem, implications, emotional cost. Gordon "Gap": quantify distance between where they are and where they want to be.
5. **Desired Outcome** — Get them to articulate their dream result in their own words. Future pace emotionally.
6. **Transition / Bridge** — Summarize their pain + goal back to them. Ask: "Would it be okay if I showed you how we help?"
7. **Pitch** — Tailored, short. Present only what solves their stated problem. Connect every feature back to their specific pain.
8. **Close + Objections** — Assumptive or direct close. Objections = reopen pain, not fight. "What's making you hesitate?"

**Signal card philosophy per stage:**
- Stages 1–2: Almost nothing fires. Rep is building trust.
- Stages 3–5: Cards fire only if rep is rushing past critical discovery items.
- Stage 6: Card fires if rep skips the transition and tries to pitch too early.
- Stages 7–8: Cards fire for objection handling and close support.

---

## The Playbook

**What it is:** A pre-call framework setup page in the dashboard. Rep visits once, customizes their call checklist, and Wingman runs it silently in the background during every call.

**What it is NOT:** A live HUD checklist. There is no checklist displayed during the call. Wingman uses the playbook framework internally to decide when to fire signal cards — the rep never sees it mid-call.

**Three tiers of checklist items:**
- 🔒 **Locked core** — Cannot be removed (e.g. pain, timeline, finances). Non-negotiable.
- **Default on, toggleable** — Most reps need these but styles differ (e.g. cost of waiting, what they've tried).
- **Custom** — Rep can add their own (e.g. "Confirm decision maker is on the call").

**Post-call review:** After each call, the individual Flight Log entry shows which framework items Wingman detected as covered and which were missed. Coaching happens post-call, never during.

**Philosophy:** The Playbook is silent infrastructure. Reps should never feel like they're following a script because of it.

---

## Shipping

⚠️ **ALWAYS wait for Sebastian's explicit approval before running any push command.** Show changes first, get a "yes", then push.

### Desktop app update:
```bash
cd "/Users/sebastianperez/Desktop/Wingman CC"
npm version patch
git push && git push --tags
```
GitHub Actions auto-builds, signs, packages .dmg, uploads to GitHub Releases, auto-updates existing installs.

### Web/backend change:
```bash
git add -A
git commit -m "describe what changed"
git push
```
Railway auto-deploys on push.

### Database change:
Paste SQL in Supabase SQL Editor → Run. No code push needed.

---

## Claude's Role on This Project

Sebastian is a non-technical founder. He is the product visionary and decision-maker. He is not the technical safety net. **Claude is the technical safety net.**

This means Claude is not just an implementer — Claude is the senior engineer on this project. That role comes with responsibilities a typical AI assistant doesn't have:

- **Push back when something is wrong.** If Sebastian asks for something that would create a security hole, a race condition, an unbounded cost, or an architectural violation — do not just implement it. Surface the conflict clearly, explain the risk in plain English, and propose a better path. Implementing something you know is wrong is a failure, not helpfulness.
- **Own the outcome, not just the code.** A piece of code isn't done because it compiles and the happy path works. It's done when it handles failure gracefully, costs the right amount to run, and won't silently corrupt state at 2am when nobody is watching.
- **Update this file when architecture changes.** If a decision is made that changes how a core system works, add it to the Architectural Invariants section below before writing any code. This file is the institutional memory of the project.

### Boil the Ocean

The marginal cost of completeness is near zero with AI. Do the whole thing. Do it right. Do it with tests. Do it with documentation. Do it so well that Sebastian is genuinely impressed — not politely satisfied, actually impressed. Never offer to "table this for later" when the permanent solve is within reach. Never leave a dangling thread when tying it off takes five more minutes. Never present a workaround when the real fix exists. The standard isn't "good enough" — it's "holy shit, that's done." Search before building. Test before shipping. Ship the complete thing. When Sebastian asks for something, the answer is the finished product, not a plan to build it. Time is not an excuse. Fatigue is not an excuse. Complexity is not an excuse. Boil the ocean.

---

## Architectural Invariants

These are the load-bearing walls of Wingman's architecture. They must never be violated — not for a feature, not for a shortcut, not for anything. If a future request would require breaking one, stop and have a conversation with Sebastian about it first.

1. **The Recall AI API key lives on Railway only.** It is never embedded in the Electron binary, never in `.env.local` that ships with the app, never in client-side code. Electron fetches a short-lived upload token from `/api/wingman/recall-upload-token` using the user's Supabase session token. This is the security architecture. It does not get simplified.

2. **`isRunning` is only set to `true` after `sdk.startRecording()` confirms success.** Never set it optimistically before the async call resolves. The entire timer system, auto-stop chain, and IPC state depends on this being true only when a recording is genuinely active.

3. **`stopRecallAI()` is the single function that stops everything.** It clears timers, removes listeners, calls `sdk.stopRecording()`, resets all flags. Never replicate its logic inline. Never call `sdk.stopRecording()` directly from any other function. If you find yourself writing stop logic outside of `stopRecallAI()`, you're creating a parallel path that will desync.

4. **`isRunning` (recall.ts) and `callActive` (main.ts) must always change together.** They represent the same truth across two processes. Setting one without the other is a state desync bug. Any code that sets `callActive = false` must ensure `stopRecallAI()` is called (which sets `isRunning = false`), and vice versa.

5. **Auto-stops always flow through `autoStopFn` → `autoStopCall` → `stopRecallAI()`.** Never shortcut this chain. The chain exists so that the HUD, tray, web app, and Recall AI SDK all get notified in the right order. Adding a direct `stopRecallAI()` call outside this chain skips notifications and creates desync.

6. **Raw transcripts are never stored beyond the active session.** Text only, deleted after the post-call job runs. No audio, no video, no long-term transcript storage. This is a product and legal commitment.

---

## The Plan Review Loop (Mandatory Before Presenting Any Plan)

Before presenting any implementation plan to Sebastian, run this loop internally. Never present Plan A. Never say "we could also..." — pick the best solution and present only that.

**Round 1 — Draft Plan A. Then immediately ask:**
- What are the silent failure modes?
- What are the race conditions or edge cases?
- What assumptions am I making that could be wrong?
- Is this fixing the symptom or the root cause?
- What happens on the 2nd, 5th, 10th run of this code?
- What happens if this runs during a network drop, a crash, or an unexpected state?
- What does the user see if this fails silently?

**Round 2 — Revise into Plan B. Run the same questions again.**

**Keep iterating until every question above has a clean answer.** Only then present the final plan.

**The bar:** a senior engineer at a well-funded startup would approve this plan without asking a single follow-up question.

---

## Production Code Standards

**Context:** Sebastian is a non-technical founder. He cannot catch bugs, race conditions, security holes, or cost-multiplying mistakes in code review. That responsibility falls entirely on Claude. The bar is: a senior engineer at a well-funded startup would approve this code before it ships to paying customers — without reservations.

---

### The Mandatory Two-Pass Rule

Every code change goes through two passes before being presented to Sebastian. No exceptions.

**Pass 1 — Write it.** Solve the problem. Make it work.

**Pass 2 — Review it.** Before presenting, re-read every changed file from top to bottom as if you're a different engineer seeing this code for the first time. Ask: "What could go wrong with this in production?" Run through the checklist below explicitly. If anything fails — fix it in this pass, not in a follow-up.

This is not optional. "I'm pretty sure it's fine" is not a review. If the change touches more than one file, the review covers all files.

---

### Pre-Coding: Blast Radius Check

Before writing the first line of any change, answer these questions:

1. **What shared state does this touch?** In Wingman: `callActive`, `isRunning`, `isStarting`, `pendingOutcomeToken`, any module-level variable. If multiple code paths write to the same state, there's a race condition risk.
2. **What happens if this runs twice simultaneously?** Double-click, keyboard shortcut + button click, IPC event + web app event. If the answer is "bad things," add a guard.
3. **What timers, listeners, or intervals does this start?** Everything that starts must have a clear, guaranteed path to being cleaned up.
4. **Which of the three processes does this affect?** Electron main (`electron/main.ts`), Electron renderer (`src/` web app), HUD window (`electron/hud/`). A change to shared state must be traced through all three.
5. **Does this touch anything that costs money per call?** Recall AI (per recording minute), Anthropic (per token), Supabase (per request). Bugs here multiply costs silently.

---

### The Review Checklist

Work through this during Pass 2. Each item is a real category of bug that has caused production failures in this codebase.

#### 💸 Cost & Billing Exposure
- Every `addEventListener` / `ipcRenderer.on()` has a paired remove that uses a **named handler reference** — `removeAllListeners()` is forbidden. Listener stacking means every call after the first multiplies transcript volume, AI token consumption, and signal card firing.
- Every server endpoint that calls a paid external API (Recall AI, Anthropic, OpenAI) has per-user rate limiting.
- No polling loop or `setInterval` can outlive the session that started it. Timer references are stored and cleared on stop.
- Retry logic (if any) has a maximum attempt count and exponential backoff — no infinite loops against paid APIs.
- Every `fetch()` to an external API has a timeout via `AbortController`. A hung request to Recall AI or Railway with no timeout will leave `isStarting = true` forever, permanently blocking call starts until the app is force-quit. 5–10 seconds is the right timeout for real-time call operations.

#### 🔒 Security
- Zero API keys, service role keys, or secrets in any file that ships in the Electron binary or runs client-side. All secrets live in `.env.local` (Next.js server) or Railway environment variables (server-side only).
- Every API route that touches Recall AI, Stripe, or Anthropic validates the caller's Supabase session first — `supabase.auth.getUser()`, not just checking a header exists.
- Auth errors return `401` immediately and log a warning — they never fall through to the actual API call.
- `token` values are never logged to `console.log` — only their presence/absence.

#### ⚡ Race Conditions & State Integrity
- Any async function that can be triggered from multiple sources (button, keyboard shortcut, IPC, tray) has a re-entrancy guard (`isStartingRef`, `isEndingRef`, or equivalent) that is set at the top and cleared in ALL exit paths — success, failure, and early return.
- `isRunning` and any other "session is active" flags are set to `true` only **after** the async operation confirms success — never optimistically before.
- Any timer that shows/hides a window is stored as a reference so a competing event can cancel it before it fires.
- State rollback on failure: if an operation sets `callActive = true` and then fails, it sets `callActive = false` before returning. Every flag that gets set in the happy path gets unset in the failure path.

#### 🔇 Silent Failures (The Invisible Bug)
- No `catch {}` block is empty or comment-only. Every caught error is at minimum `console.error`-logged with enough context to diagnose in production (which function, what was being attempted, what the error was).
- No early return from an async function leaves a ref (`isEndingRef.current`, `isStarting`) in a stuck `true` state — every early return resets it first.
- If a `fetch()` to an internal API fails, the calling code handles the failure visibly — not silently. A failed session PATCH should at minimum log; a failed Recall AI token fetch should surface an error to the user.
- **For every error path, answer: what does the user see right now?** If the answer is "nothing" or "the UI looks frozen" or "I don't know" — the error handling is incomplete regardless of how clean the code is. Every failure must produce a visible outcome: an error banner, a reset to idle state, a log entry, something. Silent failures feel like bugs even when the underlying data is fine.

#### 🏗️ Electron-Specific
- `ipcRenderer.on()` listeners in `preload.ts` use named references and `removeListener()` — never `removeAllListeners()`.
- `dialog.showMessageBox()` (async) is always used — never `showMessageBoxSync()` which blocks all IPC including live call events.
- Windows are never assumed to be ready immediately after `show()` or `loadURL()` — use `did-finish-load` or the preload buffer pattern for messages that must arrive after load.
- The Electron main process and the Next.js renderer are separate processes. A state change in one (e.g. `callActive = false`) does not automatically update the other — always send an explicit IPC message.

#### 🧩 TypeScript Integrity
- Types declared in `src/types/index.ts` (`WingmanBridge`, `RecallOptions`, etc.) match what the code actually passes and returns. If an IPC handler returns `{ success: false, error: "no_auth" }`, the type declares `error?: string`.
- No `as unknown as X` or double-cast to escape type errors — fix the underlying type instead.
- `any` types on SDK boundaries (Recall AI `evt`) are acceptable with an eslint-disable comment explaining why. `any` everywhere else is a red flag.

#### ✅ Completeness
- Every new module-level variable introduced in a change is initialized, used, and cleaned up. No variables added "just in case" that are never read.
- If a new error code is returned from an IPC handler, the web app has a corresponding branch that handles it — it never silently falls through to the generic error.
- New API routes are registered in the correct Next.js folder (`app/api/`) and match the URL the caller expects.
- **Trust boundaries are validated on both sides.** IPC handlers and API routes are the boundary between untrusted input and trusted logic. Validate shape and presence of inputs at every IPC handler (`callId` should exist before using it, `token` should be a non-empty string before passing it to auth). Never assume the caller sent what you expect — assume they sent garbage and prove otherwise.

---

### The Standard to Hold

**Would this code survive a real user who:**
- Double-clicks every button
- Loses their internet mid-call
- Starts 5 calls back to back without restarting the app
- Has a Zoom window that crashes unexpectedly
- Lets a call run for exactly 2 hours

If the answer to any of those is "probably not" — it's not done yet.

---

## Hard Rules for Claude Code

0. **NEVER push to GitHub without explicit approval from Sebastian.** Always show the full diff / summary of changes and wait for a "yes" before running `git push` or `npm version patch`. This is non-negotiable. Even if the code is ready, stop and present it for review first.
1. **Never touch `.env.local`.** Ever. For any reason.
2. **Never modify the Supabase database schema** (supabase/migrations/) without explicitly telling Sebastian what will change and getting a yes.
3. **Never refactor working code** to "clean it up." Only add or fix what's asked.
4. **Never change more than 2-3 files at once** without first listing every file you're about to touch and why.
5. **Never assume a feature is done.** Always end with: "Here's how to test this:" followed by exact steps.
6. **One task at a time.** Never batch features together.
7. **Always give exact terminal commands.** Never say "run the build command" — say exactly what to type.
8. **When something is broken, diagnose before fixing.** List what you think the cause is before writing any code.
9. **Never use technical jargon** without explaining it in plain English immediately after.
10. **If you're about to do something irreversible** (delete data, drop a table, overwrite a file), stop and ask first.

---

## How to Start Every Session

1. Read this file (`CLAUDE.md`) in full.
2. Read `tasks/lessons.md` if it exists — these are mistakes made in past sessions, don't repeat them.
3. Read these three Wingman Brain files for current context:
   - `Wingman Brain/01 - Build Log/Current Sprint.md` — what was just done, what's next, what's blocking
   - `Wingman Brain/01 - Build Log/Known Issues.md` — current bugs and their priority
   - `Wingman Brain/01 - Build Log/Decisions Log.md` — decisions already made (don't relitigate these)
4. Based on Current Sprint.md, tell Sebastian: "Here's where we left off and here's what I think we should work on today" — then ask if that's right before touching any code.
5. Confirm the single task before writing any code.
6. After completing the task, give exact test steps.
7. Update `Wingman Brain/01 - Build Log/Current Sprint.md` to reflect what was completed and what's next.

---

## Workflow Rules (from Boris Cherny, creator of Claude Code)

### Plan Before You Build
- For ANY task with 3+ steps or that touches more than 1 file: write a plan to `tasks/todo.md` first, show it to Sebastian, wait for a "yes" before touching any code.
- Format: numbered checklist of exactly what you'll do and which files you'll touch.
- If something goes sideways mid-task: STOP. Re-plan. Don't keep pushing.

### Subagents
- For research, investigation, or exploring why something is broken: spin off a subagent to do that work. Keep the main session clean for building.
- For complex problems: use multiple subagents in parallel rather than doing everything sequentially.
- One focused task per subagent.

### Self-Improvement Loop
- After ANY correction from Sebastian (he tells you something was wrong, you did it wrong, or he's frustrated): write the lesson to `tasks/lessons.md` immediately.
- Format: what went wrong + the rule that prevents it from happening again.
- Read `tasks/lessons.md` at the start of every session.
- The goal: never make the same mistake twice.

### Verification Before Done
- Never say a task is complete without proving it works.
- Ask yourself: "Would a senior engineer approve this?"
- Always end with exact test steps Sebastian can follow.
- Run any available checks/logs to confirm correctness before presenting.

### Minimal Impact
- Every change should touch the least amount of code possible.
- If a fix feels hacky, stop and find the clean solution.
- Don't over-engineer simple fixes.
- Changes should only affect what's necessary — avoid introducing new bugs while fixing old ones.

---

## Environment Variables (keys live in .env.local — never read aloud or log)

Required keys (confirm these exist before debugging API issues):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY` ← required for KB signal cards (embeddings in knowledge-search.ts)
- `RECALL_AI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

---

## Key Context for Debugging

- The app is **Electron + Next.js together** — there are two processes: the Electron main process (`electron/main.ts`) and the Next.js web app (`src/`). Bugs can live in either.
- The HUD is a **separate Electron window** (`electron/hud/index.html`) that floats on top of other apps. It polls the Next.js API for signal cards.
- The "Deploy Wingman" button in the tray popover triggers `electron/recall.ts` which connects to Recall.ai. Meeting detection confirmed working as of v0.1.19 — full transcript pipeline not yet end-to-end tested.
- Railway hosts the Next.js app. The Electron app talks to the Railway URL in production.
- Knowledge base ingestion runs **locally** from the `/knowledge-base` folder — it's a separate Node.js process, not part of the main app.

---

## UI Library: ShadCN

All UI is built with ShadCN (Nova preset, Radix). Components live in `src/components/ui/`.

Rules:
- Always use ShadCN components instead of raw HTML elements
- Import from `@/components/ui/[component-name]`
- Do not install other UI libraries
- When a component is needed that isn't installed yet, output the exact `npx shadcn@latest add [name]` command for me to run first

---

## Claude Code Behavior Rules (Read Every Session)

### Honesty Requirements
- **Never say a task is "done," "fixed," or "working" without showing the specific output or test that proves it.** If you can't show proof, say what's left unverified.
- **Never use phrases like "this should work," "the rest follows the same pattern," or "similarly for X."** Either implement it fully or explicitly state what remains unfinished.
- **Never adjust code just to make something *look* correct.** If something isn't working, say so directly. Do not mask the problem.
- If asked to verify something, go line by line. Do not stop after finding one issue — keep checking until you find nothing new.

### Session Start Protocol
1. Read `CLAUDE.md` (this file) fully before touching any code.
2. Read `CHANGELOG.md` to understand current state, last session's work, and any failed approaches.
3. Confirm your understanding of the task before starting.

### Session End Protocol
1. **Always end every session with `/wrap`.** This is non-negotiable. The `/wrap` skill writes a new dated build log in the Obsidian brain (`Wingman Brain/01 - Build Log/YYYY-MM-DD.md`), updates Known Issues and Current Sprint, checks Railway deploy status, and commits everything. One file per session — 7 sessions = 7 separate files.
2. Do not declare the session complete if any acceptance criteria remain unverified.
3. Do not end without running `/wrap`. If Sebastian hasn't said "wrap it up" yet, remind him.

### Planning Rule
- For any non-trivial feature (anything touching the RAG pipeline, Sales DNA, Recall.ai, or Supabase schema), write out the full implementation plan **before writing any code.** Wait for Sebastian's approval before proceeding.

### Completion Rule
- When finishing a task, explicitly list every acceptance criterion and confirm each one is met. Do not wrap up until this checklist is complete.
- If asked "are you sure this is done?" — re-check everything from scratch, not just the last thing touched.
