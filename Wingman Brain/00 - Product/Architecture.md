# Wingman Architecture

> ⚠️ **The "Real-Time Pipeline" + "RAG Pipeline" sections below were rewritten 2026-07-01 to match what actually ships.** Two big changes have shipped since the original 2026-04-02 draft: (1) cards are **hotkey-SUMMONED, not autonomous** (2026-05-31 pivot); (2) the live objection card uses **Sonnet with NO KB/RAG** (decided 2026-06-21, shipped 06-29). Canonical current design: `Hotkey Model Build Plan.md` + `Phase 2 — Live Call Memory Design.md` + Decisions Log (2026-05-31, 2026-06-21). The **Post-Call Pipeline** section remains accurate.

Last updated: 2026-07-01

---

## Overview

Wingman is a Mac desktop app (Electron + Next.js) that sits invisibly over a sales call and surfaces a coaching card at the exact right moment. Two pipelines run in parallel: a real-time live pipeline that must respond in under 1 second, and an async post-call pipeline that runs after the call ends.

---

## Real-Time Pipeline (Live Call) — hotkey-summoned

Cards are **summoned by the rep, not fired autonomously.** The rep presses **Up Arrow** → a 4-arrow **compass** appears (↑ objection · ← answer · ↓ dig deeper · → close readiness) → the rep picks a direction → Wingman generates that one card. Nothing appears on screen unless the rep asks for it.

```
Recall.ai Desktop SDK
  ↓ (streams real-time transcript chunks via local socket)
recall.ts (Electron main process)
  ↓ (IPC: transcript chunk)
useRecallTranscript.ts / useWingmanPoller.ts (renderer)
  ├─ BACKGROUND: Belief Ladder summarizer (Sonnet 4.6, ~2-min timer) → calls.live_summary
  └─ rep presses Up Arrow → compass → picks a direction
        ↓
      /api/wingman/kb-signal  (the summoned-card endpoint)
        ↓  ↑ objection = context-driven Sonnet prompt, NO retrieval (objection-signal.ts)
        ↓  (← answer · ↓ dig · → close = Phase 4, not built yet)
      card streamed to HUD via SSE → IPC hud:signal-delta
        ↓
      HUD window (electron/hud/index.html) — progressive word-by-word reveal
```

**Target latency:** first words on screen in ~0.5–0.8s (streaming); full card ~1.7–2.7s warm.

**Key design decision:** the rep controls when a card appears. Cost is ~$0 continuous (buffering + a background summarizer), and we pay for a card only when the rep presses. The old "fire the RAG+Haiku pipeline autonomously on a keyword" model is gone.

---

## Trigger Classifier (`keyword-triggers.ts`) — DORMANT

Historically the first gatekeeper: a pattern-based classifier that *autonomously fired* a card when it detected a meaningful moment. **After the 2026-05-31 hotkey pivot it no longer launches cards** — the rep summons them. It survives at most as a silent "scout" (tagging context) and is slated for removal in cleanup (Phase 5). The old 90-second cooldown is obsolete for summoned cards.

*(For reference, the moments it used to watch for: price-objection signals, unanswered pain questions, close resistance, pitching-before-confirming.)*

---

## Knowledge Base / RAG — Wingman Coach only (NOT live cards)

**As of 2026-06-21 the KB is NOT in the live objection-card path.** The live objection card is a context-driven **Sonnet** prompt with no retrieval (`objection-signal.ts`) — see the Real-Time Pipeline above. The RAG pipeline below now serves the **Wingman Coach** (Mission Intel), the between-call coaching chatbot, only.

**How Coach retrieval works:**
- Embed the query with OpenAI `text-embedding-3-small` (same space as ingestion).
- Vector search over the KB (419 entries from ~37 YouTube training videos). Live search runs **in-memory** in the Node process (~10–20ms, PR #17), with the Supabase pgvector RPC kept as a circuit-breaker fallback.
- Assemble prompt (Coach persona + retrieved techniques + call context) → **Claude Sonnet 4.6** → coaching reply.

> Historical note: the original live signal card used this same embed → pgvector → **Haiku** path. That was retired for the live objection slot on 2026-06-21 (a blind A/B showed the KB added no distinguishable value and its forced-script rule hurt cards). Kept here for the Coach.

---

## Post-Call Pipeline (Async)

Runs after the call ends. Never runs during a live call.

```
Call ends
  ↓
post-call/route.ts fires (async job)
  ↓
Claude Sonnet reads full transcript
  ↓
Extracts:
  - Call grade (A/B/C/D)
  - One-line debrief
  - One win (what the rep did right)
  - One fix (what to do differently next time)
  - Top objections raised on this call
  - Offer Brain delta (what new patterns appeared)
  ↓
Offer Brain JSON updated in Supabase
Flight Log entry created (grade, debrief, win, fix)
Objections written to vault_objections table
Raw transcript retained (text only, user-deletable)
```

**Model:** Claude Sonnet — quality over speed for post-call analysis.

---

## The Offer Brain

One JSON object per user stored in Supabase `profiles` table. Loads at call start. Updated after every call by the post-call job.

**What it stores:**
```json
{
  "offer": {
    "name": "12-week fitness coaching",
    "price": 3500,
    "delivery": "1:1 video calls + app"
  },
  "prospect_archetypes": [
    "Busy professional, knows what they need, just needs a push",
    "Price sensitive, compares to gym memberships"
  ],
  "top_objections": [
    { "objection": "I need to think about it", "what_worked": "Reopen pain — ask what they're really thinking about" },
    { "objection": "That's more than I expected", "what_worked": "Gordon Gap — what does not solving this cost per month?" }
  ],
  "price_reveal_patterns": {
    "avg_silence_seconds": 4,
    "prospect_response_patterns": ["sticker shock first, then opens up", "asks about payment plans"]
  },
  "close_timing": {
    "avg_minutes_to_close": 42,
    "fastest": 28,
    "slowest": 67
  }
}
```

**Why this is the moat:** Every call makes the Offer Brain smarter. After 50 calls, it knows this rep's offer, their common prospect archetypes, and exactly which responses have worked before. A competitor can clone the UI. They can't clone 50 calls of learned context.

---

## Sales Knowledge Base

Built by running the local ingestion tool in `/knowledge-base/`:

```
YouTube URL → yt-dlp (downloads audio) → Whisper (transcribes) → Claude Sonnet (extracts KB entries) → OpenAI embeddings → Supabase pgvector
```

**Current KB stats (as of v0.1.19):**
- 37 videos ingested
- ~15 hours of content
- 419 KB entries
- Similarity threshold: 0.65 (tuned down from 0.78 to improve recall)

**KB entry structure:**
Each entry is a discrete sales technique or principle with a title, the full technique text, the source video, and a `vector(1536)` embedding.

---

## Tech Stack (Full)

| Layer | Tool | Purpose |
|-------|------|---------|
| Desktop shell | Electron (TypeScript) | Mac app, tray icon, HUD overlay window |
| Web dashboard | Next.js 15 (App Router) | Dashboard UI, all API routes |
| Live audio | Recall.ai Desktop SDK | Joins call as invisible bot, streams transcript |
| Transcription | Deepgram (inside Recall.ai) | Speech-to-text engine |
| Live AI | Claude Haiku | Signal card generation — target <1s |
| Post-call AI | Claude Sonnet | Call grading, debrief, Offer Brain update |
| Embeddings | OpenAI `text-embedding-3-small` | KB ingestion + runtime similarity search |
| Database | Supabase (PostgreSQL) | All persistent data |
| Vector search | pgvector (in Supabase) | RAG retrieval from Sales KB |
| Hosting | Railway | Next.js app + API routes |
| Billing | Stripe | Subscription management |
| Affiliate tracking | Rewardful | Affiliate commission tracking |
| Desktop distribution | GitHub Actions + electron-builder | Auto-build, sign, package .dmg on release |
| iMessage funnel | Blooio / Project Blue | Conversion trigger at moment of close |

---

## Process Architecture (Electron-Specific)

Wingman has three separate processes that must stay in sync:

1. **Electron main process** (`electron/main.ts`) — app lifecycle, tray, window management, IPC hub
2. **Next.js renderer** (`src/`) — dashboard UI and all API routes (also runs embedded in Electron)
3. **HUD window** (`electron/hud/index.html`) — floating overlay, polls for signal cards

State changes must be explicitly communicated between processes via IPC. A change in main.ts does not automatically appear in the renderer — always send an explicit IPC message.

---

## Key State Variables

| Variable | Where | What It Means |
|----------|-------|--------------|
| `isRunning` | `recall.ts` | Recall.ai SDK is actively recording |
| `callActive` | `main.ts` | A call session is in progress |
| `isStarting` | `recall.ts` | Call start is in progress (prevents double-click) |
| `pendingOutcomeToken` | `main.ts` | Token for the post-call outcome card |

**Critical invariant:** `isRunning` and `callActive` must always change together. Setting one without the other causes state desync bugs.

---

## Security Architecture

- The Recall AI API key lives on Railway only — never in the Electron binary
- Electron fetches a short-lived upload token from `/api/wingman/recall-upload-token` using the user's Supabase session
- Every API route validates the caller's Supabase session first (`supabase.auth.getUser()`)
- No API keys, service role keys, or secrets ship in the Electron binary or client-side code
