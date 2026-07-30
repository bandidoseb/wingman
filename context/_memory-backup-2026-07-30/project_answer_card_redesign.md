---
name: project-answer-card-redesign
description: "Answer arrow → general LLM (no KB); Close arrow shouldn't touch KB; rename kb-signal route; future proprietary-dataset upload"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0265a86b-74f1-4faf-8515-639878d13915
  modified: 2026-07-22T18:13:38.118Z
---

Sebastian's intent for the ← Answer and → Close arrows and the `kb-signal` route (raised 2026-07-22, NOT yet built).

**Current code reality (verified 2026-07-22 — corrected after an initial WRONG read):**
- ↑ **objection** + ↓ **dig** = pure streaming Sonnet, NO KB. (via `kb-signal/route.ts`; `main.ts` only ever sends these two slots to that route.)
- → **close** = the **readiness chip** (PR #50), handled **client-side** in `DashboardClient.tsx` `handleClosePick` → force-fresh Belief Ladder → `scoreReadiness()` (`close-readiness.mjs`, pure, NO AI, NO KB, NO fetch). Shows Not Ready/Continue Discovery/Almost Ready/Ready to Pitch. It does NOT run `generateSignalCard`. (I earlier claimed Close ran the KB path — that was WRONG; a leftover `close` branch in the route is dead code, not the live behavior.)
- ← **answer** = **NOT built** — `direction !== "objection"` → "coming soon" unsupported pill. Calls nothing.
- The `searchKnowledge`→`generateSignalCard` block in `kb-signal/route.ts` (lines ~360-377) is therefore **DEAD CODE today** — no client path reaches it. `searchKnowledge` embeds the chunk (OpenAI) + cosine search → real added latency (~0.5-1s+), which is WHY Answer must not use it.
- The route file NAME (`kb-signal`) is legacy (from when everything used the KB).

**What Sebastian wants:**
1. **Answer = general LLM call, not KB-first.** Use case: rep doesn't know the answer to a domain question a prospect asks (e.g. "land-investing business in all 50 states — how am I taxed?") → presses ← → gets a straight, general-LLM answer.
2. **Close should NOT touch the KB.** It needs a real "close" behavior (design TBD — likely a Sonnet close-line off the Belief Ladder / Weakest Link), not the KB answer path.
3. **Rename/kill the `kb-signal` name** — the live signal cards no longer use the KB (objection/dig never did; answer/close should stop). Renaming the API route touches the Electron HUD/client caller too (coordinated change; safe given zero users + held local).

**FUTURE (log for an engineer down the line — NOT now, explicitly deferred):** sell to companies with **proprietary datasets** → they upload their dataset → Answer can query it to answer **domain-specific** questions (RAG over customer-owned data). This is where the KB machinery could be repurposed. Not necessary now.

**FUTURE / WATCH (Sebastian 2026-07-22):** he is genuinely considering **removing the KB from the Wingman Coach too** ("but that's for another day"). If that happens, the KB — pgvector, embeddings, ingestion tool, `knowledge-search.ts`/`knowledge-signal.ts` — becomes FULLY removable (live cards already don't use it). Don't act; just know the KB's days may be numbered project-wide.

Relates to [[project-card-voice-rework]] (the pinned NEXT — voice comes first).
