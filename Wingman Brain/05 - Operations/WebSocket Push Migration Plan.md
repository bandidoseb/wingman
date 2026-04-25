# WebSocket Push Migration Plan

Created: 2026-04-25
Status: Ready to build — dedicated session needed

---

## Why This Exists

Wingman currently polls the server every 8–90 seconds (depending on call stage) to check for signal cards and scorecard updates. This has two problems:

1. **Latency:** A signal card can sit ready on the server for up to 90 seconds before the HUD sees it
2. **Cost:** 191 Sonnet polls + 252 background Haiku KB scans per 60-minute call = $1.98 in AI inference. With push, that drops to $0.37 (81% reduction)

The fix: replace polling with Pusher WebSocket push. Server pushes signal cards and scorecard updates the moment they're ready. No interval at all.

---

## Current Architecture (what exists today)

```
Recall.ai → transcript chunk
    ↓
electron/recall.ts → IPC → DashboardClient.tsx
    ↓
useWingmanPoller.ts → addChunk()
    ↓ (two parallel paths)
    ├─ FAST PATH: checkKeywordTriggers() → keyword hit → runKBCheck() → POST /api/wingman/kb-signal → Haiku → fireSignal()
    └─ SLOW PATH: chunkBuffer accumulates → setInterval fires → executePoll() → POST /api/wingman/poll → Sonnet → scorecard + maybe signal
```

**Key files:**
- `src/hooks/useWingmanPoller.ts` — client-side polling hook. Has `setInterval`, buffer, `executePoll()`, `runKBCheck()`, `fireSignal()`
- `src/app/api/wingman/poll/route.ts` — Sonnet stage tracking endpoint. Returns scorecard update + optional signal
- `src/app/api/wingman/kb-signal/route.ts` — Haiku RAG signal card endpoint. Returns signal_header + signal_text
- `src/lib/wingman/poll-intervals.ts` — interval config per stage (Rapport: 90s → Close: 8s). **Deleted in new architecture.**

**The background Haiku KB scan (biggest cost waste):**
In `addChunk()`, there is a `backgroundDue` check that fires `runKBCheck()` every 10 seconds even with no keyword trigger. This accounts for $0.41/call. **Kill this first** — it's a standalone 30-minute fix before the full migration.

---

## New Architecture (what to build)

```
Recall.ai → transcript chunk
    ↓
electron/recall.ts → IPC → DashboardClient.tsx
    ↓
useWingmanPoller.ts → addChunk()
    ↓ (two parallel paths)
    ├─ FAST PATH (unchanged): checkKeywordTriggers() → keyword hit → runKBCheck() → POST /api/wingman/kb-signal → Haiku → fireSignal() locally
    └─ SMART PATH (new): chunk accumulated → POST /api/wingman/process-chunk → server decides when to run Sonnet → result PUSHED via Pusher → client receives → fireSignal() or updateScorecard()
```

**What changes:**
- `setInterval` removed entirely from `useWingmanPoller.ts`
- Client subscribes to a Pusher channel (`call-{callId}`) at call start, unsubscribes at call end
- Server pushes two event types: `signal` (new card to show) and `scorecard` (updated stage/scorecard)
- The fast path (keyword → KB signal → immediate card) stays exactly as-is — no change
- Background Haiku KB scan (the `backgroundDue` path) is DELETED

---

## Pusher Channel Strategy

**Channel name:** `private-call-{callId}`
- Private channel (requires auth) so only the authenticated user can subscribe
- One channel per active call
- Client subscribes when call starts, unsubscribes when call ends

**Events pushed from server:**
- `wingman:signal` — `{ type, header, text, firedAt }` — show a signal card
- `wingman:scorecard` — `{ stage, pain_locked, pain_detail, ... }` — update live scorecard

**Pusher auth endpoint needed:** `POST /api/pusher/auth` — validates Supabase session before allowing channel subscription

---

## Files to Create / Modify

| File | Action | What changes |
|---|---|---|
| `src/hooks/useWingmanPoller.ts` | Major rewrite | Remove setInterval, intervalRef, chunkBuffer flush, backgroundDue KB scan. Add Pusher client subscription. Keep keyword trigger fast path. |
| `src/app/api/wingman/poll/route.ts` | Rename + rewrite | Becomes `process-chunk/route.ts`. Instead of returning JSON response, pushes result to Pusher channel. |
| `src/app/api/pusher/auth/route.ts` | Create new | Pusher channel auth endpoint. Validates Supabase session, returns Pusher auth token for private channel. |
| `src/lib/wingman/poll-intervals.ts` | Delete | No longer needed — no intervals in push architecture |
| `electron/main.ts` | No change | Transcript IPC path unchanged |
| `electron/recall.ts` | No change | Recall.ai integration unchanged |

---

## Environment Variables Needed

Add to both `.env.local` (local dev) and Railway (production):

```
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=us2   # or whichever cluster is closest
NEXT_PUBLIC_PUSHER_KEY=   # same as PUSHER_KEY — exposed to client
NEXT_PUBLIC_PUSHER_CLUSTER=   # same as PUSHER_CLUSTER
```

The `NEXT_PUBLIC_` prefixed vars are safe to expose to the browser (they're the publishable key, not secret).

---

## Step-by-Step Build Order

1. **Sign up for Pusher** — create app, get credentials, set cluster to `us2`
2. **Add env vars** to `.env.local` and Railway
3. **Create `/api/pusher/auth`** — Pusher private channel auth. Validate Supabase session → return Pusher auth. This is the security gate.
4. **Rewrite `/api/wingman/poll`** → `/api/wingman/process-chunk` — same Sonnet logic, but instead of `return NextResponse.json(parsed)`, push to Pusher channel and return `{ ok: true }`
5. **Rewrite `useWingmanPoller.ts`** — remove setInterval and buffer flush. Add Pusher client subscription on call start. Handle `wingman:signal` and `wingman:scorecard` events.
6. **Delete `poll-intervals.ts`** — no longer referenced
7. **Test:** start a simulated call, verify signal cards arrive without any polling delay

---

## What Stays the Same

- Keyword trigger fast path — `checkKeywordTriggers()` still fires immediately and synchronously
- KB signal route (`/api/wingman/kb-signal`) — still called via fetch, still returns immediately. Could eventually be pushed too, but leave it as-is for now.
- All scorecard state management — same fields, same types
- Signal card cooldown logic — `fireSignal()` still respects 90s cooldown
- Post-call job — completely separate, unchanged

---

## Cost After Migration

Per 60-minute call:
- Sonnet (event-driven, ~40 meaningful batches): $0.32
- Haiku KB (keyword triggers only, ~12): $0.02
- Post-call: $0.03
- **Total: $0.37** (vs. $1.98 today — 81% reduction)

Pusher cost: $0 at beta scale (free tier: 1,000 concurrent connections, 200K messages/day). $49/month at meaningful scale.

---

## Do This First (Before Full Migration)

**Quick win — kill the background Haiku KB scan:**
In `useWingmanPoller.ts`, find the `backgroundDue` logic in `addChunk()`:

```typescript
} else if (backgroundDue) {
  lastKBCheckRef.current = now;
  runKBCheck(chunk);
}
```

Delete the entire `else if (backgroundDue)` block and the `lastKBCheckRef` and `KB_CHECK_COOLDOWN_MS` declarations. Keep the `keywordHit` path. This alone saves $0.41/call and takes 30 minutes with zero architecture change.
