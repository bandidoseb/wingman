# CLAUDE.md — Wingman AI Sales Copilot

Read this entire file before doing anything. This is the source of truth for the Wingman project.

---

## What Is Wingman

Wingman is a Mac desktop app (Electron + Next.js) that acts as a real-time AI copilot during high-ticket sales calls. It listens live, detects crucial moments, and surfaces a "signal card" on screen — the exact thing to say — in under 1 second. Invisible to the prospect.

**Builder:** Sebastian. Non-technical. Always give exact terminal commands. Never assume coding knowledge. Never use jargon without explaining it.

**Repo:** bandidoseb/wingman  
**Local path:** `/Users/sebastianperez/Desktop/Wingman CC`  
**Deployed via:** Railway (web/backend auto-deploys on git push). Desktop app needs a release cut.  
**Releases repo:** `bandidoseb/wingman-releases` — PUBLIC, holds only signed installers. Source stays private.  
**Current version:** 0.1.29 (shipped, signed, notarized, published live 2026-07-27 — auto-update confirmed working)

⚠️ That version number goes stale between sessions. `package.json` is the truth — and `context/STATE.md` reads it for you. Never trust a hand-typed version.

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

**Note on notarization:** ✅ Builds ARE Apple-signed (Developer ID) **and notarized** as of 2026-07-01 (v0.1.27+). Users no longer see the "unidentified developer" warning and **do not** need the old `xattr -dr com.apple.quarantine` Terminal workaround — do not include it in the beta onboarding email. (Notarization runs in CI via `mac.notarize: true` in `electron-builder.yml` using the Apple secrets already in the release workflow.)

---

## Tech Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Desktop app | Electron (TypeScript) | Mac app shell + floating HUD overlay |
| Web/dashboard | Next.js (App Router) | Dashboard UI, API routes, auth |
| Live audio | Recall.ai | Joins the call, streams transcript |
| Transcription | Deepgram (inside Recall.ai) | Speech to text |
| AI — live | Claude **Sonnet 4.6** (`claude-sonnet-4-6`) | Hotkey-summoned cards: **↑ objection** / **↓ dig** = Sonnet, streaming, NO KB · **→ close** = client-side readiness chip (no AI call) · **← answer** = NOT built. KB kept for the **Coach only**. See "The Compass" below. |
| AI — post-call | Claude Sonnet | Call grading, debrief, Sales DNA update |
| Database | Supabase | Users, calls, Sales DNA JSON, KB embeddings |
| Vector search | pgvector (in Supabase) | KB retrieval — **Wingman Coach only** since 2026-06-21 (no longer live objection cards) |
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
│   ├── hud/index.html         # Floating HUD overlay + Live Hub pill. NO network calls — pure IPC consumer
│   └── tray-popover/index.html # Tray menu UI
│
├── src/                       # Next.js web app (dashboard + API)
│   ├── app/
│   │   ├── (auth)/            # Login, signup pages
│   │   ├── (dashboard)/       # Main dashboard (DashboardClient.tsx, HomeTab, etc.)
│   │   └── api/
│   │       ├── wingman/
│   │       │   ├── session/   # Start/end call session
│   │       │   ├── poll/      # polled by the Next.js renderer (useWingmanPoller) — NOT by the HUD
│   │       │   ├── kb-signal/ # hotkey-summoned card endpoint (legacy name — rename queued)
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
│   │   ├── dashboard/         # FlightLogTab, HomeTab, IntelTab, ObjectionVaultTab, PersonalizeTab, SettingsTab, Sidebar, coach/, home/
│   │   ├── wingman/           # ⚠️ ALL DEAD — LiveCallView has zero importers, so SignalCard/SignalLog/StageBar/LiveScorecard die with it
│   │   ├── onboarding/        # Multi-step onboarding flow components
│   │   └── ui/                # Shared UI primitives
│   │
│   ├── lib/
│   │   ├── wingman/
│   │   │   ├── objection-signal.ts   # ↑ objection card — Sonnet 4.6, streaming, NO KB
│   │   │   ├── dig-signal.ts         # ↓ dig/"Discover" card — Sonnet 4.6, streaming, NO KB
│   │   │   ├── dig-prompt.mjs        # ↓ prompt (DIG_SYSTEM_PROMPT — never rename, eval ids depend on it)
│   │   │   ├── close-readiness.mjs   # → close chip — pure client-side scoring, NO AI call
│   │   │   ├── belief-ladder.ts      # live summarizer (Belief Ladder → calls.live_summary)
│   │   │   ├── knowledge-search.ts   # vector search — LIVE, but only for the Coach (api/ai/chat)
│   │   │   ├── rep-profile.ts        # Sales DNA loader
│   │   │   ├── knowledge-signal.ts   # ⚠️ DEAD — reached only from a guarded branch that never runs
│   │   │   ├── keyword-triggers.ts   # ⚠️ DEAD — zero importers (was the autonomous trigger classifier)
│   │   │   └── query-distill.ts      # ⚠️ DEAD — zero importers (Groq distiller, cut 2026-06-30)
│   │   └── supabase/                 # Supabase client (client, server, middleware)
│   │
│   └── hooks/
│       ├── useRecallTranscript.ts    # Hooks into Recall.ai transcript stream
│       └── useWingmanPoller.ts       # renderer polling + triggers + summarizer + summarizeNow()
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

## Current Build Status

⚠️ **This section goes stale fast.** Reconcile against git and `tasks/launch-plan.md` before trusting it — see "How to Start Every Session," step 4. `context/STATE.md` is generated and always current; this is the narrative.

### ✅ Shipped and live (v0.1.29, published 2026-07-27)
- **Full live pipeline works end-to-end** — Recall.ai → transcript → hotkey-summoned card → HUD. Tested on real calls. Measured cost ~$1.25/recorded hour, 75–80% margin.
- Compass slots: **↑ objection** and **↓ dig** stream from Sonnet 4.6 · **→ close** is a client-side readiness chip · **← answer NOT built**.
- Live summarizer (Belief Ladder) on a ~2-min background timer → `calls.live_summary`.
- Live Hub pill — drag/persist, content-protection, waveform. Replaced the tray-only surface.
- Post-call job → grade, debrief, 6 `call_stages`, objections, Sales DNA delta.
- Post-call flow — call-end popups killed; the pill morphs Live → "generating debrief" → "View call" and deep-links into that Flight Log entry. Outcome auto-detected by the post-call job (confidence-gated, excluded from close-rate until confirmed).
- Dashboard — Home + Coach, Sales DNA (Personalize), Flight Log, Objection Vault, Settings, dark mode. Intel is an intentional "Coming soon" placeholder.
- Auth, multi-step onboarding, Objection Vault (only ever populated from real calls), owner dashboard, private `/changelog`.
- Recall AI upload-token flow — API key lives on Railway, Electron fetches a short-lived token via an authenticated route (Invariant #1).
- Knowledge base: 37 videos, ~15 hours, 419 KB entries ingested — now used by the **Coach only**.
- **Auto-update works** — signed, notarized, publishes live to `bandidoseb/wingman-releases`. Confirmed by Sebastian on v0.1.29.
- Flight Recorder (`dev-logs/*.jsonl`) — DEV-ONLY, gated on `NODE_ENV !== "production"`.

### ❌ Not built / not wired
- **← Answer card** — the one empty compass slot; shows a "coming soon" pill.
- **Stripe billing** — routes exist (checkout, webhook, portal), not live or tested.
- **iMessage upsell trigger** (Project Blue / Blooio).
- **Windows / Intel Mac** — blocked by the Recall SDK. Not planned.

### 🗑️ Retired — do NOT rebuild
- **Autonomous card firing** — replaced by the compass. See "The Compass" below.
- **Live stage bar** — `electron/hud/index.html:841` forces `#stageBar { display: none !important; }`. Stages are post-call only.
- **HUD "How'd it go?" outcome card** — retired in v0.1.29; disposition lives in Flight Log. `api/wingman/hud-outcome/route.ts` is now an orphan.
- **Signal Vault tab** and **Flight Plan tab** — deleted 2026-07-29. Sales DNA supersedes Flight Plan. ⚠️ `api/flight-plan/route.ts` has no UI caller, but the post-call job still reads `call.flight_plan_snapshot` — do not delete the column blind.
- **Mission Intel staggered multi-bubble chat** — dropped 2026-07-30; the Coach replies as one message.
- **The Playbook page** — never built. See below.

---

## Definition of Done (V1 Beta)

A user can:
1. Open Wingman and click Deploy
2. Wingman listens live on their sales call
3. The rep **summons** a card with the compass (↑ then a direction) at the moment they need it — rare, powerful, never spammy
4. The Live Hub pill shows Wingman is listening, and stays out of the way
5. Call ends → the pill morphs to "generating debrief" → "View call", deep-linking into that Flight Log entry
6. Post-call job fires automatically and auto-detects the outcome
7. User goes to dashboard → sees Flight Log entry with transcript, debrief, grade, framework coverage
8. User can chat with "Ask Wingman" (the Coach) about any call
9. Objections from the call appear in their Objection Vault
10. Sales DNA updates silently in the background
11. Rep sets up their **Sales DNA** once (Personalize tab) → Wingman uses it silently in every card

*(Reconciled 2026-07-30 — items 3, 4, 5 and 11 previously described autonomous firing, a live stage bar, the "How'd it go?" card, and the Playbook page. All four were retired or never built.)*

**That's the finish line. Everything else is V2.**

---

## Core Product Rules (Never Violate)

1. **Cards are HOTKEY-SUMMONED, never autonomous.** Wingman pops nothing up on its own. The rep presses ↑ to open the compass, then picks a direction. *(Reconciled 2026-07-30 — rules 1–4 previously described the retired autonomous-firing model: queueing, a 90-second cooldown, "almost nothing fires during Rapport." `useWingmanPoller.ts:500` states the trigger path was removed. A `NON_ALERT_COOLDOWN_MS = 90_000` constant survives on the legacy poll path and governs nothing the rep sees. Upstream source: `00 - Product/Bubble Discipline.md`.)*
2. **One card at a time. Never queue.** A new summon replaces the current card; nothing stacks.
3. **The test is "has the prospect revealed anything real?" — NEVER how many minutes in.** (Card doctrine, locked 2026-07-28.)
4. **If nothing real has surfaced, Wingman admits it has nothing.** The quiet state is the literal string `"Nothing to work with yet."` It may **never** invent a question out of its own head to fill silence.
5. **Signal cards use the prospect's exact words** (tie-down language).
6. **Transcripts are retained (text only), user-deletable.** Kept after the post-call job — "Ask Wingman," the Flight Log transcript view, and (planned) follow-up-call prospect memory all rely on them. The rep can delete them per-call or account-wide (compliance — Issue #33). Never auto-deleted. *(Reconciled 2026-06-05 — the old "deleted immediately" line was stale and contradicted the live code, which keeps transcripts.)*
7. **Never store audio or video.** Text only.
8. **Post-call job never runs during a live call.** Always async.
9. **Sales DNA updates silently.** User never configures it manually.
10. **Wingman is bowling alley bumpers — not a script.** It only activates when a rep is about to go in the gutter. It does NOT tell reps what to say on every exchange. Reps that sound like they're reading AI suggestions are a product failure. Signal cards should be rare, surgical, and feel like intuition — not instructions.
11. **Never make reps into robots.** If a feature would cause a rep to sound scripted, unnatural, or disconnected from the prospect — don't build it. The highest-performing closers in the industry will judge this product harshly if it produces robotic behavior. That reputation damage kills the business.

---

## The Compass — how live cards are actually summoned

Wingman fires **nothing** on its own. The rep summons a card:

- **Press ↑** → the compass menu opens over the HUD (auto-fades after 5s; `esc` dismisses).
- **Then press a direction** to pick a slot.

| Key | Slot (code id) | User-facing label | Status |
|-----|----------------|-------------------|--------|
| ↑ (double-tap Up) | `objection` | Handle objection | ✅ LIVE — Sonnet 4.6, streaming, no KB (`objection-signal.ts`) |
| ↓ | `dig` | Dig deeper → being renamed **"Discover"** | ✅ LIVE — Sonnet 4.6, streaming, no KB (`dig-signal.ts`) |
| → | `close` | Close | ✅ LIVE — client-side readiness chip, **no AI call** (`close-readiness.mjs`) |
| ← | `answer` | Answer question | ❌ NOT BUILT — shows a "coming soon" pill |

⚠️ The ↓ rename to **"Discover"** is **user-facing labels ONLY**. Never rename `dig-prompt.mjs`, `DIG_SYSTEM_PROMPT`, the `"dig"` direction id, or any eval id — the eval harness keys off them.

Path: `electron/main.ts` (`openCompassMenu` / `registerPick` / `registerDirect` / double-tap-Up) → IPC `wingman:menu-pick` → `DashboardClient.tsx` → `POST /api/wingman/kb-signal` (streaming) → Pusher → renderer → IPC → HUD.

---

## AI Architecture

*(Section was titled "RAG Pipeline." The live card path has had no retrieval step since 2026-06-21 — the KB now serves the Coach only.)*

```
Recall.ai desktop SDK → live transcript chunks (Deepgram inside Recall)
         ↓  IPC
DashboardClient (Next.js renderer) ── useRecallTranscript → useWingmanPoller
         ↓
  ├─ every ~2 min: POST /api/wingman/summarize → Sonnet 4.6 → Belief Ladder → calls.live_summary
  └─ NOTHING fires on its own. Waits for a compass press.
         ↓  rep presses ↑ then a direction
POST /api/wingman/kb-signal   (legacy route name — rename queued)
         ↓
  ↑ objection → objection-signal.ts → Claude Sonnet 4.6, STREAMING, NO KB
  ↓ dig       → dig-signal.ts       → Claude Sonnet 4.6, STREAMING, NO KB
  → close     → close-readiness.mjs → pure client-side scoring, NO AI CALL
  ← answer    → NOT BUILT
         ↓  Pusher → renderer → IPC
HUD card streams in (electron/hud/index.html)
         ↓
[Call ends]
         ↓
Post-call job (Claude Sonnet) — async:
  Grade + debrief + one win + one fix + objections + 6 call_stages + Sales DNA delta
         ↓
Sales DNA JSON updated in Supabase
Flight Log entry created
Raw transcript retained (text only, user-deletable — Ask Wingman + follow-up memory rely on it)
```

**DEAD CODE — do not treat as live** (Phase-5 removal, Known Issue #37): `keyword-triggers.ts` · `query-distill.ts` · `knowledge-signal.ts` (reached only from a guarded branch in `kb-signal/route.ts` that no client path hits) · all of `src/components/wingman/` · `api/wingman/hud-outcome/route.ts`.

⚠️ **`knowledge-search.ts` is NOT dead** — `api/ai/chat/route.ts` calls `searchCoachingKnowledge()` for the Wingman Coach. Do not delete it with the rest.

---

## Sales DNA

*(Renamed from "Offer Brain" on 2026-05-31 — same system, more neutral/personal name. **There is no rename sweep to do.** `grep -rn "offer_brain\|offerBrain" src electron supabase` returns nothing: the term never existed in app code or the schema. `rep-profile.ts` is just a filename. Reconciled 2026-07-30 — this note previously described a pending sweep as outstanding work, and it was a phantom task.)*

One JSON object per user stored in Supabase. Loads at call start. Updated after every call by post-call job.

Stores: offer details, prospect archetypes, top objections + what handled them, price reveal patterns, average close timing.

Rules: One active Sales DNA per user. Never let the user manually configure it. Reset button exists (with warning). This is the product's #1 moat and switching cost.

---

## Call Stages — 6 operational stages (NEPQ depth underneath)

**The system tracks SIX stages:** **Rapport · Discovery · Press · Confirm · Pitch · Close.** This is what the code actually uses (`STAGE_ORDER` in `post-call/route.ts` + `IntelTab.tsx`). The post-call Sonnet job derives them from the transcript into `call_stages`; the dashboard shows them (Intel coverage heatmap + Flight Log per-call framework coverage). They are **not shown live** during the call — the hotkey pivot removed the live stage bar. *(Reconciled 2026-07-01: docs previously said "8-stage" and a 2026-06-03 note said "4 universal" — neither matched the code, which ships 6. Six is canonical.)*

The **Jeremy Miner (NEPQ) + Cole Gordon 8-stage methodology is the coaching *philosophy* — the depth underneath the 6**, not a separate system. It maps in:

| System stage (code) | NEPQ / Gordon depth underneath |
|---|---|
| **Rapport** | Rapport / Tonality — peer frame, match energy. + Pre-frame / Agenda — how the call works, permission to ask, kills objections early. |
| **Discovery** | Situation — fact-find: current state, context, what they've tried. |
| **Press** | Pain / Problem — NEPQ dig into the real problem, implications, emotional cost; Gordon "Gap": quantify where they are vs. where they want to be. |
| **Confirm** | Desired Outcome — dream result in their own words, future-pace. + Transition / Bridge — summarize pain+goal, "would it be okay if I showed you how we help?" |
| **Pitch** | Tailored, short. Present only what solves their stated problem; tie every feature to their pain. |
| **Close** | Close + Objections — assumptive/direct close; objections = reopen pain, not fight ("what's making you hesitate?"). |

**Stage-aware card logic** (shapes the summoned objection card's context + post-call framework coverage — NOT autonomous firing, which is retired): early (Rapport/Discovery) → almost nothing relevant; Press/Confirm → matters if the rep rushed discovery or is pitching before confirming; Pitch/Close → objection handling + close support.

---

## The Playbook — SHELVED, do not build

A pre-call framework setup page was specced in early 2026 and **never built**. There is zero code: `grep -rn "Playbook" src electron` returns nothing. It is not on the launch cutline in `tasks/launch-plan.md`.

The need it was meant to serve is now met by two shipped things: **Sales DNA** (the Personalize tab — the rep's offer and style, captured once) and **post-call framework coverage** inside each Flight Log entry.

Do not build this without an explicit new decision from Sebastian. The cutline rule applies: *does this block a Test Pilot from using the 4 arrows?* It does not.

<details>
<summary>Original spec, kept for the record (never implemented)</summary>

**What it was:** A pre-call framework setup page in the dashboard. Rep visits once, customizes their call checklist, and Wingman runs it silently in the background during every call.

**What it was NOT:** A live HUD checklist. There is no checklist displayed during the call. Wingman uses the playbook framework internally to decide when to fire signal cards — the rep never sees it mid-call.

**Three tiers of checklist items:**
- 🔒 **Locked core** — Cannot be removed (e.g. pain, timeline, finances). Non-negotiable.
- **Default on, toggleable** — Most reps need these but styles differ (e.g. cost of waiting, what they've tried).
- **Custom** — Rep can add their own (e.g. "Confirm decision maker is on the call").

**Post-call review:** After each call, the individual Flight Log entry shows which framework items Wingman detected as covered and which were missed. Coaching happens post-call, never during.

**Philosophy:** The Playbook is silent infrastructure. Reps should never feel like they're following a script because of it.

</details>

---

## Shipping

⚠️ **ALWAYS wait for Sebastian's explicit approval before running any push command.** Show changes first, get a "yes", then push.

**Workflow: branch → PR → review → merge (adopted 2026-05-31).** Never commit feature work directly to `main`. `main` is the live product — merging to it deploys to Railway. So:

### Web/backend change (the normal flow):
```bash
git checkout -b descriptive-branch-name
git add -A
git commit -m "describe what changed"
git push -u origin descriptive-branch-name
gh pr create --fill
```
On the PR, two GitHub Actions run automatically:
- **CI** (`.github/workflows/ci.yml`) — typecheck (web + electron) + unit tests + **`token-lint`** (fails on any NEW hardcoded color literal; ratchets down, never up — run `npm run token-lint -- --update` after migrating a screen). Must pass.
- **Security Review** (`.github/workflows/security-review.yml`) — AI security scan, posts inline comments. Does not block; read its findings.

⚠️ CI does **not** run a Next.js build, so a build-only failure reaches Railway unseen. Run `npm run build:verify` locally before merging anything structural. **Never plain `npm run build`** — it overwrites `.next` and kills Sebastian's running dev server.

Once green and reviewed, merge the PR → **Railway auto-deploys `main`.**

### Desktop app update (release):
⚠️ **`main` is protected by a GitHub ruleset — you CANNOT push the version bump directly to it** (the old `npm version patch; git push --tags` flow fails with a rule violation). Route the bump through a PR, then tag the *merged* commit:

```bash
cd "/Users/sebastianperez/Desktop/Wingman CC"
git checkout -b release/vX.Y.Z
npm version patch                  # bumps package.json, commits, creates local tag vX.Y.Z
git push -u origin release/vX.Y.Z
gh pr create --fill               # wait for CI "checks" to pass, then squash-merge
```
After merge, the local tag points at the wrong (pre-merge) commit. Re-tag the merged commit — **the tag push is what triggers the build:**
```bash
git fetch origin main
git tag -f vX.Y.Z origin/main
git push origin vX.Y.Z
```
The `release.yml` Action (triggered by the `v*` tag) builds + signs + **notarizes** + packages, then publishes **LIVE — not a draft — to the separate PUBLIC repo `bandidoseb/wingman-releases`.** The private source repo `bandidoseb/wingman` holds no current releases. This is set in `electron-builder.yml` (`publish.repo: wingman-releases`, `releaseType: release`) and uses the `WINGMAN_RELEASES_TOKEN` secret.

✅ **Auto-update WORKS** — confirmed live by Sebastian on v0.1.29 (2026-07-27). Installed apps update themselves via `electron-updater` reading the public feed. A private repo's `releases.atom` 404s, which is exactly why releases moved to a public repo (Known Issue #45).

There is **no** `gh release edit --draft=false` step any more. Running it against `bandidoseb/wingman` will fail, because the release isn't there.

To confirm a release actually landed:
```bash
gh release list --repo bandidoseb/wingman-releases --limit 5
```
Both a `.dmg` (first manual download) and a `.zip` must be attached — `electron-updater` can only apply a `.zip`, never a `.dmg`.

*(Reconciled 2026-07-30 — this block previously said releases upload as drafts to the source repo and that auto-update was broken. Both were false, and following the old instructions would have failed against the wrong repo.)*

> CI not firing on a fresh PR is a known GitHub hiccup — close + reopen the PR (`gh pr close N; gh pr reopen N`) to re-fire the `pull_request` event.

### Database change:
Paste SQL in Supabase SQL Editor → Run. No code push needed.

### One-time setup for the new workflow (Sebastian):
- Add a GitHub repo secret `ANTHROPIC_API_KEY` (Settings → Secrets and variables → Actions) so Security Review can run.
- Optional but recommended: enable branch protection on `main` (require CI to pass before merge).

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

6. **Audio and video are NEVER stored — text transcripts only.** This half is non-negotiable: no audio, no video, ever. Text transcripts, however, ARE retained after the post-call job — the rep reviews them, "Ask Wingman" reads them, and follow-up-call prospect memory will build on them — and are user-deletable per-call or account-wide (compliance — Issue #33). *(Reconciled 2026-06-05 — the prior "transcripts deleted after post-call" wording was stale; the 2026-04-23 decision keeps them, which the live code already does.)*

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

The full review checklist now lives in the **`wingman-reviewer`** subagent (`.claude/agents/wingman-reviewer.md`) — moved out of this file so it runs as an automated **fresh-context review on every diff** (more reliable than an always-loaded checklist, and it keeps this file lean per Anthropic's guidance that bloated CLAUDE.md files get ignored).

**Pass 2 is now: run the `wingman-reviewer` subagent on the diff before presenting any code change as done.** It covers — in full — cost & billing exposure, security, race conditions & state integrity, silent failures, Electron-specific pitfalls, TypeScript integrity, and completeness/trust-boundary checks.

Backing it up deterministically: a **`tsc` typecheck gate** (Stop hook in `.claude/settings.json` → `.claude/hooks/typecheck-gate.sh`) blocks any coding turn from ending while TypeScript is broken (web + electron). Hooks are enforced; CLAUDE.md is advisory.

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

The SessionStart hook (`.claude/hooks/session-start.sh`) already injects live git/GitHub status into your context before you read anything. Trust **it** over any prose, including this file.

1. Read this file (`CLAUDE.md`) in full.
2. Read `context/STATE.md` — **generated**, never hand-written. Version, orphan modules, and one-line indexes of every decision, issue, and build log.
3. Read `Wingman Brain/01 - Build Log/NOW.md` — what's next, what's blocked, what's in flight, the backlog. This is the only hand-written state file, and it is size-capped.
4. Read `tasks/lessons.md` — mistakes made in past sessions, don't repeat them.
5. Read `tasks/launch-plan.md` — **the cutline**. Before proposing ANY work, ask: *does this block a Test Pilot from using the 4 arrows?* If no → Parking Lot, even when the idea is good.
6. Read `Wingman Brain/01 - Build Log/Known Issues.md` for open bugs.
7. **Anything older is on-demand, not at startup.** `STATE.md`'s indexes tell you what exists; go read the full file when a question touches it:
   - `Decisions Log.md` — **read before re-opening any architecture question.** That is what it is for.
   - `Sprint Archive.md` + `Wingman Brain/01 - Build Log/YYYY-MM-DD.md` — the full narrative of any past session.
   - `Known Issues Archive.md` — root-cause write-ups. Search it before re-diagnosing anything.
8. **If prose and git disagree, git wins — say so out loud.** Prose holds *decisions and intent*; git holds *status*. If the hook didn't run, reconcile manually:
   ```bash
   cd "/Users/sebastianperez/Desktop/Wingman CC" && git branch --show-current && git status --short && git log --oneline -5 && gh pr list --state merged --limit 5 && gh release list --repo bandidoseb/wingman-releases --limit 3
   ```
   ⚠️ Releases live in the **separate public repo** `bandidoseb/wingman-releases`. A bare `gh release view` reads the source repo and reports a version several releases stale — that exact bug sat in this file for a month.
9. Tell Sebastian: "Here's where we left off and here's what I think we should work on today" — then ask if that's right before touching any code.
10. Confirm the single task before writing any code.
11. After completing the task, give exact test steps.
12. End with `/wrap`, which updates `NOW.md`, the dated log, Known Issues, the changelog, and memory — and regenerates `STATE.md`.

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

**Supabase**
- `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY`

**AI**
- `ANTHROPIC_API_KEY` — every live card, the summarizer, the post-call job, the Coach
- `OPENAI_API_KEY` — embeddings for KB ingestion + the **Wingman Coach** search only (live cards stopped embedding 2026-06-21)

**Realtime — REQUIRED. Live cards fail silently without these.**
- Server: `PUSHER_APP_ID` · `PUSHER_KEY` · `PUSHER_SECRET` · `PUSHER_CLUSTER`
- Client: `NEXT_PUBLIC_PUSHER_KEY` · `NEXT_PUBLIC_PUSHER_CLUSTER`

**Recall**
- `RECALL_AI_API_KEY` — Railway ONLY, never in the Electron binary (Invariant #1)

**Stripe** (routes exist, billing not live)
- `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

**Dev only** — never set on Railway
- `WINGMAN_DEVLOG=1` + `NEXT_PUBLIC_WINGMAN_DEVLOG=1` — Flight Recorder. Also gated on `NODE_ENV !== "production"`, so it is a hard no-op in prod.

**No longer required on Railway — but KEEP it in `.env.local`**
- `GROQ_API_KEY` — the app no longer uses it. The Groq distiller left the live objection path on 2026-06-30 (`kb-signal/route.ts`: "NO Groq") and `query-distill.ts` has no runtime caller. **But two local dev harnesses still read it:** `scripts/test-distill.mjs` **hard-fails** without it ("cannot run"), and `scripts/kb-ab-test.mjs` warns and degrades. So: safe to drop from Railway, do not delete from `.env.local`. *(This line previously said it was "required for Phase 3.5" — dead advice. Corrected again 2026-07-30 after a first pass wrongly claimed "nothing breaks if it's absent," which is false for the dev scripts.)*

---

## Key Context for Debugging

- The app is **Electron + Next.js together** — there are two processes: the Electron main process (`electron/main.ts`) and the Next.js web app (`src/`). Bugs can live in either.
- The HUD is a **separate Electron window** (`electron/hud/index.html`, ~2,700 lines) that floats on top of other apps. It makes **no network requests at all** — it renders whatever the main process pushes over IPC (`hud:update-signal`, `hud:update-signal-delta`, `hud:summon-state`, `hud:readiness`, `hud:flow-state`; see the `hud` namespace in `electron/preload.ts`). API calls happen in the Next.js renderer (`DashboardClient.tsx` → `useWingmanPoller`); results reach the HUD via Pusher → renderer → IPC → main → HUD. **If a card doesn't appear, the break is almost never in the HUD** — check Pusher keys and the renderer first.
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
1. **Always end every session with `/wrap`.** This is non-negotiable. The `/wrap` skill writes a new dated build log in the Obsidian brain (`Wingman Brain/01 - Build Log/YYYY-MM-DD.md`), rewrites `NOW.md`, updates Known Issues, adds a changelog entry, refreshes memory, regenerates `context/STATE.md`, and commits everything. One file per session — 7 sessions = 7 separate files.
2. Do not declare the session complete if any acceptance criteria remain unverified.
3. Do not end without running `/wrap`. If Sebastian hasn't said "wrap it up" yet, remind him.

### Planning Rule
- For any non-trivial feature (anything touching the RAG pipeline, Sales DNA, Recall.ai, or Supabase schema), write out the full implementation plan **before writing any code.** Wait for Sebastian's approval before proceeding.

### Completion Rule
- When finishing a task, explicitly list every acceptance criterion and confirm each one is met. Do not wrap up until this checklist is complete.
- If asked "are you sure this is done?" — re-check everything from scratch, not just the last thing touched.
