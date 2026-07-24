# Streaming the post-call debrief into the dashboard (polish — NOT launch-critical)

**Logged 2026-07-24. Priority: LOW / post-launch. Good "new-hire developer" task** — self-contained,
touches a well-understood flow, no live-call-pipeline risk. Sebastian: "cool to have but not necessary."

## The idea
Make the AI debrief **type itself into the Flight Log entry** as it generates — the Granola effect —
instead of the current "skeleton, then the finished debrief appears" (which fills in on a poll).

## Why it's NOT a quick copy of the signal-card streaming
1. **The card is plain text; the debrief is structured JSON** (`{debrief, outcome, objections_raised,
   missed_topics, pillar_coverage, stages}` in `src/app/api/wingman/post-call/route.ts`). You can't stream
   JSON token-by-token into the UI (half-finished JSON isn't parseable). Clean fix: generate the debrief
   PROSE as its own quick **plain-text** Sonnet call (streams exactly like a card) and keep the structured
   analysis as a separate call. The two run in parallel server-side.
2. **Durability catch (the important one).** Post-call runs **fire-and-forget server-side** — it finishes
   and writes `calls.summary` even if the rep closes the laptop the instant the call ends. If we streamed
   by having the client hold the connection (like the HUD does for cards), closing the dashboard
   mid-generation would lose the debrief. **The server job must stay authoritative.**

## The clean design (preserves durability)
- Keep the fire-and-forget server job as the **source of truth** — it always finishes + writes
  `calls.summary`.
- ADD a live view: the job **broadcasts debrief tokens over Supabase Realtime** on a per-call channel
  (e.g. `debrief:{call_id}`). The dashboard subscribes and appends tokens as they arrive.
- If the rep wasn't watching / reconnects → fall back to reading the finished `calls.summary` (already
  what the code does today). Reconnect-safe, no double-generation.

## Tradeoffs to weigh at build time
- Debrief is only 2-3 sentences → the "wow" is smaller than Granola (they stream pages).
- Splitting into two Sonnet calls sends the transcript twice → input tokens are cheap but per-call cost
  bumps modestly.
- New client pattern: the dashboard doesn't consume streams today (only the HUD does). Needs a Realtime
  subscription + the split-generation. Touches the call-end flow → **plan-review required** before build.

## Files a dev would touch
`src/app/api/wingman/post-call/route.ts` (split debrief call + Realtime broadcast) ·
`src/components/dashboard/FlightLogTab.tsx` (subscribe + append tokens into the debrief card) ·
Supabase Realtime enablement/config.

## The cheap 80% alternative (already available, no streaming)
Tighten the dashboard's debrief-ready poll from 5s → ~2s so the "Debrief ready" pill and the Flight Log
skeleton fill in 1-3s sooner. See `DashboardClient.tsx` pendingOutcome poll + `FlightLogTab.tsx`
detail-poll (both currently 5000ms). That gets most of the perceived-speed win for ~5 minutes of work.

Related: `tasks/plan-post-call-flow.md` (the shipped redesign this builds on), memory `project_post_call_flow`.
