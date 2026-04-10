# Known Issues

Last updated: 2026-04-10

A running list of known bugs, limitations, and things that need fixing. Add new issues at the top. Update status when resolved. Never delete — mark as Resolved with the date.

---

## Open Issues

| #   | Issue                                                            | Impact     | Status              | Notes                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------- | ---------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 21  | Embedding latency too high — no Redis cache | **Medium** | Open | OpenAI embedding calls in `knowledge-search.ts` are taking 400ms–2400ms (cold start on Railway can hit 2400ms). Target is under 200ms. Root cause: no caching — every keyword trigger re-embeds the same or similar phrases from scratch. Fix: add Redis cache keyed on the transcript chunk (or a normalized version). Not blocking for beta but will become a problem under real call volume. Cold start latency will also improve as Railway keeps the instance warm. |
| 20  | FlightLogTab Mission Intel chat permanently blocks after any error | **Low** | Open | `globalInFlightRef` and `callInFlightRef` in `FlightLogTab.tsx` are set to `true` at the start of `sendGlobalMessage` / `sendCallMessage` but only reset in the happy path. If an error is thrown before the catch block, or inside the catch block, the ref stays `true` forever and the chat input stops responding. Fix: move `ref.current = false` into a finally block in both functions. |
| 19  | Session route call-limit check is not atomic | **Low** | Open | `POST /api/wingman/session` reads `monthCount` then inserts a new call, but two simultaneous requests can both pass the limit check before either inserts. At low beta volume this is negligible but should be fixed before scaling. Fix: enforce the limit at the database level with a trigger or use a single `rpc` call that checks-and-inserts atomically. |
| 18  | IPC listeners in DashboardClient could double-register in React StrictMode | **Low** | Open | `onToggleCall`, `onAutoEnded`, `onOutcomeUpdated`, and `onSignalDismiss` are registered in `useEffect` with empty dependency arrays. In React StrictMode (dev), effects run twice. Each double-registration means two handler calls per event. Cleanup functions are present so this self-corrects after unmount, but could cause transient double-fires in dev. Not a production risk — StrictMode is dev-only. Confirm preload bridge already guards against stacking before fixing. |
| 17  | Chat `setTimeout` chains leave orphaned timers on component unmount | **Low** | Open | `sendGlobalMessage` and `sendCallMessage` in `FlightLogTab.tsx` use `await new Promise(resolve => setTimeout(resolve, ...))` for the staggered bubble effect. If the user navigates away while messages are streaming in, the timeouts still fire and attempt state updates on an unmounted component. React 18 suppresses the warning but the closure still holds references. Fix: use an `AbortController` ref or `isMounted` ref to bail out of the stagger loop on unmount. |
| 16  | Post-call `calls_used` increment is not concurrency-safe | **Low** | Open | `PATCH /api/wingman/session` increments `calls_used` with a read-then-write pattern. Two simultaneous PATCH requests (e.g., user clicks End Call + keyboard shortcut both fire before the guard clears) could both read the same value and both increment, resulting in only +1 instead of +2. The `isEndingRef` guard in `DashboardClient` prevents the most common double-fire, but the route should use a Supabase `rpc` atomic increment as a safety net. |
| 11  | Signal cards never fire — fireSignal bug | **Critical** | Resolved 2026-04-07 | Fixed — `fireSignal(keywordHit)` now called in `useWingmanPoller.ts:addChunk`. Keyword signals also bypass the 90s cooldown. Confirmed on a real test call: "this is too expensive" fired a card. KB-sourced cards still return 0 matches (see Issue #14). |
| 12  | Transcript duplicates in dashboard and database | **High** | Resolved 2026-04-07 | Fixed — `realtimeListenerRegistered` flag prevents listener stacking across call sessions. Dedup logic in `realtimeHandler` changed to last-text-per-speaker (no time window) — only emits when speaker text changes. Poll chunk size limit raised 10K→50K as safety net. Needs end-to-end test on a real call to confirm clean. |
| 13  | Post-call job fails with 502 on Anthropic overload | **High** | Open | Post-call route calls Anthropic Sonnet with no retry logic. If Anthropic returns `overloaded_error`, the job fails silently — no debrief, no grade, no Offer Brain update. Fix: add 3 retries with exponential backoff in `post-call/route.ts`. |
| 14  | KB returns 0 matches on every search | **High** | Open | KB entries were embedded using `trigger_phrase + technique_name + full_detail` — all written from the rep/coach perspective. Search queries are raw prospect speech. Semantic mismatch causes similarity to fall below 0.65 threshold every time. Fix: re-ingest all 37 videos with a new `prospect_trigger` field containing 10-15 examples of what the prospect says before this technique is needed. |
| 15  | HUD visible during Zoom screen share | **Medium** | Needs testing | `setContentProtection(true)` is set on the HUD window but was visible during a test call where screen was shared. May be a dev build limitation — needs to be tested with a packaged .dmg. Do not treat as confirmed bug until tested in production build. |
| 10  | Transcript buffer discarded if call ends before poll timer fires | **High**   | Resolved 2026-04-04 | Fixed — `flushBuffer()` added to `handleEndCall` and `handleAutoEnd` in `DashboardClient.tsx`. |
| 1   | Signal card pipeline not yet live-tested on a real call          | **High**   | Partially resolved  | First test call run 2026-04-04. Transcript confirmed saving. Signal cards NOT firing (see issue #11). |
| 2   | Playbook page not yet built                                      | **High**   | Open                | Pre-call framework setup page is in V1 scope but not yet built. Without it, Wingman has no framework context for signal cards beyond the default.                                                                              |
| 3   | Stripe billing not fully wired                                   | **Medium** | Open                | Routes exist (checkout, webhook, portal) but the full subscription flow has not been end-to-end tested with a real payment.                                                                                                    |
| 4   | iMessage conversion funnel not built                             | **Medium** | Open                | The Blooio/Project Blue integration for the free-tier conversion trigger is not started. Affects GTM, not core product function.                                                                                               |
| 5   | App is not Apple-notarized                                       | **Medium** | Open                | Beta testers must run `xattr -dr com.apple.quarantine "/Applications/Wingman.app"` in Terminal after installing. Must be documented in beta onboarding email. Notarization requires Apple Developer account and signing setup. |
| 6   | Session memory is in-memory (not Redis)                          | **Low**    | Open                | Session context (what's happened on this call) is stored in-memory in the Railway process. If Railway restarts mid-call, session context is lost. Acceptable for beta. Needs Redis before scaling to real production load.     |
| 7   | Post-call similarity threshold tuned but not validated           | **Low**    | Open                | KB similarity threshold was lowered from 0.78 → 0.65 to improve recall. Not yet validated on real calls. May produce lower-quality matches. Need live call data to tune.                                                       |

---

## Resolved Issues (Archive)

| #   | Issue                                                               | Resolution                                                | Date       |
| --- | ------------------------------------------------------------------- | --------------------------------------------------------- | ---------- |
| R1  | Recall AI region wrong (us-east-1 instead of us-west-2)             | Fixed in recall.ts region config                          | 2026-03-xx |
| R2  | KB similarity threshold too high (0.78) causing near-zero retrieval | Lowered to 0.65                                           | 2026-03-xx |
| R3  | Post-call job SSL error                                             | Fixed                                                     | 2026-03-xx |
| R4  | Middleware was blocking API routes with auth redirect               | Fixed — excluded API routes from middleware auth redirect | 2026-03-xx |
| R5  | Recall AI provider key wrong — `deepgram` rejected by API           | Changed to `deepgram_streaming` in recall-upload-token/route.ts. Recall AI changed their API format. Was causing 400 error on every call start — recording could never begin. | 2026-04-03 |
| R6  | Zoom display name requirement not visible in tray/HUD               | Added setup-required toast to HUD (with "Open Settings" button), inline warning to tray popover, and zoom name status synced from web app to main process via IPC. | 2026-04-03 |

---

## Issue Entry Format

When adding a new issue:

```
| [#] | [What is broken and where] | [High/Medium/Low] | Open | [Any context, reproduction steps, or related files] |
```

**Impact levels:**
- **High:** Blocks a user from completing a core workflow (starting a call, seeing a signal card, accessing the flight log)
- **Medium:** Degraded experience but workaround exists, or affects non-core feature
- **Low:** Minor, edge case, or affects developer experience only
