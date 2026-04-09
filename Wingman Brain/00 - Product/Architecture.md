# Wingman Architecture

Last updated: 2026-04-02

---

## Overview

Wingman is a Mac desktop app (Electron + Next.js) that sits invisibly over a sales call and surfaces a coaching card at the exact right moment. Two pipelines run in parallel: a real-time live pipeline that must respond in under 1 second, and an async post-call pipeline that runs after the call ends.

---

## Real-Time Pipeline (Live Call)

```
Recall.ai Desktop SDK
  ↓ (streams real-time transcript chunks via local socket)
recall.ts (Electron main process)
  ↓ (IPC: transcript chunk)
useRecallTranscript.ts (Next.js hook in renderer)
  ↓
keyword-triggers.ts — fast pattern classifier
  ↓ (only on meaningful moments — objection detected, key phrase, etc.)
knowledge-search.ts — embed trigger chunk → pgvector search → top 3 KB entries
  ↓
knowledge-signal.ts — assemble prompt → Claude Haiku → signal card JSON
  ↓ (IPC: hud:signal)
HUD window (electron/hud/index.html) — floating overlay, renders signal card
```

**Target latency:** Under 1 second from trigger detection to signal card on screen.

**Key design decision:** Only fire the RAG+Haiku pipeline when the trigger classifier confirms a meaningful moment. This keeps costs low and quality high — we don't embed and search the KB on every transcript chunk.

---

## Trigger Classifier (`keyword-triggers.ts`)

The first gatekeeper. A fast, pattern-based classifier that reads each transcript chunk and decides: "Is this a moment worth generating a signal card for?"

**What it looks for:**
- Price objection signals ("that's a lot," "I need to think about it," "let me talk to my spouse")
- Pain questions going unanswered (rep moves past discovery too fast)
- Close resistance signals ("not sure if this is the right time")
- Confirmation before pitch (rep about to pitch without confirming)

**What it ignores:**
- Small talk, rapport building, pleasantries
- Clear progress moments (prospect already bought in)
- Any moment within the 90-second cooldown window

**Current implementation:** Pattern matching + keyword lists. Not a full ML classifier yet — that's a V2 upgrade if needed.

---

## RAG Pipeline (`knowledge-search.ts` + `knowledge-signal.ts`)

When the trigger classifier fires, this pipeline retrieves the most relevant sales technique for the moment.

**Step 1 — Embed the trigger chunk**
The transcript chunk that triggered the classifier is embedded using OpenAI `text-embedding-3-small`. Same model used during KB ingestion, so vectors are in the same space.

**Step 2 — Vector search**
Supabase pgvector RPC `search_kb_entries()` finds the top 3 KB entries above a similarity threshold of 0.65. The KB has 419 entries as of v0.1.19, sourced from ~37 YouTube sales training videos (~15 hours of content).

**Step 3 — Prompt assembly**
The signal card generation prompt includes:
- System prompt (Wingman's coaching philosophy, stage context)
- Offer Brain (what this rep sells, prospect archetypes, what's worked before)
- Session memory (what's happened on this specific call so far)
- Top 3 KB techniques (from vector search)
- The trigger chunk (the exact words that triggered the card)

**Total prompt budget:** ~1,300 tokens per trigger. Lean enough for Haiku to process in under 300ms.

**Step 4 — Claude Haiku**
Model: `claude-haiku-4-5-20251001`. Output: a signal card JSON with the exact coaching suggestion, formatted for the HUD overlay.

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
Raw transcript DELETED immediately
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
