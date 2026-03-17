# CLAUDE.md — Wingman AI Sales Copilot

Read this entire file before doing anything. This is the source of truth for the Wingman project.

---

## What Is Wingman

Wingman is a Mac desktop app (Electron + Next.js) that acts as a real-time AI copilot during high-ticket sales calls. It listens live, detects crucial moments, and surfaces a "signal card" on screen — the exact thing to say — in under 1 second. Invisible to the prospect.

**Builder:** Sebastian. Non-technical. Always give exact terminal commands. Never assume coding knowledge. Never use jargon without explaining it.

**Repo:** bandidoseb/wingman  
**Local path:** `/Users/sebastianperez/Desktop/Wingman CC`  
**Deployed via:** Railway (web/backend auto-deploys on git push). Desktop app needs a release cut.  
**Current version:** 1.7  

---

## Tech Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Desktop app | Electron (TypeScript) | Mac app shell + floating HUD overlay |
| Web/dashboard | Next.js (App Router) | Dashboard UI, API routes, auth |
| Live audio | Recall.ai | Joins the call, streams transcript |
| Transcription | Deepgram (inside Recall.ai) | Speech to text |
| AI — live | Claude Haiku | Signal card generation, target <1 second |
| AI — post-call | Claude Sonnet | Call grading, debrief, Offer Brain update |
| Database | Supabase | Users, calls, Offer Brain JSON, KB embeddings |
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
│   │       │   ├── post-call/ # Post-call AI job (grade, debrief, Offer Brain)
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
│   │   ├── dashboard/         # FlightLogTab, HomeTab, IntelTab, ObjectionVaultTab, SettingsTab, Sidebar, SignalVaultTab
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
│   │   │   ├── rep-profile.ts        # Offer Brain loader
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
- Post-call job + Offer Brain updating (~98% confident)
- Flight Log screen ✅
- Mission Intel / IntelTab ✅
- Objection Vault tab ✅
- Onboarding flow (multi-step) ✅
- Auth (login/signup) ✅
- Stripe routes exist (checkout, webhook, portal) — not fully wired/tested
- Knowledge base: 37 videos, ~15 hours, 419 KB entries ingested ✅

### ❌ Broken / not connected
- **Deploy Wingman button broke in v1.7** — button turns red but Wingman doesn't actually deploy. This is the #1 priority to fix before anything else.
- Recall.ai live transcript connection — uncertain if fully working
- End-to-end pipeline has NOT been tested (pieces built but not connected)
- Stripe billing — not live
- iMessage upsell trigger — not built yet

### 🔲 Not built yet
- Stripe billing fully wired
- iMessage upsell trigger (Project Blue / Blooio)
- Windows support (Mac only for now)

---

## Definition of Done (V1 Beta)

A user can:
1. Open Wingman and click Deploy
2. Wingman listens live on their sales call
3. Signal cards pop up at the right moments (objections, key triggers) — rare, powerful, not spammy
4. Stage bar tracks them through the call stages
5. Call ends → post-call job fires automatically
6. User goes to dashboard → sees Flight Log entry with transcript, debrief, grade
7. User can chat with "Ask Wingman" about that specific call
8. Objections from the call appear in their Objection Vault
9. Offer Brain updates silently in the background

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
9. **Offer Brain updates silently.** User never configures it manually.

---

## AI Architecture (RAG Pipeline)

```
Recall.ai transcript stream
         ↓
Keyword trigger classifier (keyword-triggers.ts) — fast, cheap
         ↓ (only fires on meaningful moments)
Embed trigger chunk → pgvector search → Sales KB (knowledge-search.ts)
         ↓
Prompt assembly: system prompt + Offer Brain + session memory + KB results + trigger chunk
         ↓
Claude Haiku → signal card → HUD (target: <1 second)
         ↓
[Call ends]
         ↓
Post-call job (Claude Sonnet) — async:
  Grade + debrief + one win + one fix + objections + Offer Brain delta
         ↓
Offer Brain JSON updated in Supabase
Flight Log entry created
Raw transcript deleted
```

---

## The Offer Brain

One JSON object per user stored in Supabase. Loads at call start. Updated after every call by post-call job.

Stores: offer details, prospect archetypes, top objections + what handled them, price reveal patterns, average close timing.

Rules: One active Offer Brain per user. Never let the user manually configure it. Reset button exists (with warning). This is the product's #1 moat and switching cost.

---

## Call Stages

1. Rapport — Build connection. Almost no signals fire here.
2. Discovery — Excavate pain.
3. Press — Make cost of inaction real.
4. Confirm — Verify all topics before pitching.
5. Pitch — Present solution tied to pain. Keep short.
6. Close — Present price confidently. Go silent. Handle objections.

*(Stages are directional — final stage logic will be refined after KB learns from ingested videos)*

---

## Shipping

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

## Hard Rules for Claude Code

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
3. Check current build status section above.
4. Ask Sebastian: "What are we working on today?" — do not assume.
5. Confirm the single task before writing any code.
6. After completing the task, give exact test steps.

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
- `RECALL_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

---

## Key Context for Debugging

- The app is **Electron + Next.js together** — there are two processes: the Electron main process (`electron/main.ts`) and the Next.js web app (`src/`). Bugs can live in either.
- The HUD is a **separate Electron window** (`electron/hud/index.html`) that floats on top of other apps. It polls the Next.js API for signal cards.
- The "Deploy Wingman" button in the tray popover triggers `electron/recall.ts` which connects to Recall.ai. **This is currently broken as of v1.7.**
- Railway hosts the Next.js app. The Electron app talks to the Railway URL in production.
- Knowledge base ingestion runs **locally** from the `/knowledge-base` folder — it's a separate Node.js process, not part of the main app.
