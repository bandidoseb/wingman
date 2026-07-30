---
name: project-post-call-flow
description: "BUILT 2026-07-24 S3 (local on feat/confrontation-dial, not pushed): call-end popups killed, Live Hub pill morphs Live→generating→'View call', deep-link + skeleton, AI outcome auto-detect"
metadata: 
  node_type: memory
  type: project
  originSessionId: 148fc7ac-3455-413f-8614-79688e76b4d5
  modified: 2026-07-24T16:24:15.578Z
---

✅ **BUILT END-TO-END 2026-07-24 Session 3** (plan-reviewed + wingman-reviewed; typecheck ×2, 194 vitest, in-browser visual verify of all 3 pill states; Sebastian live-tested the happy path). Log: `Wingman Brain/01 - Build Log/2026-07-24.md` Session 3. **All local on `feat/confrontation-dial`, NOT pushed** — bundles into v0.1.29 with the Live Hub / close-readiness / summarizer / Flight Recorder work.

**What shipped:** killed the call-end "Wingman stopped" toast + the "How'd it go?" outcome card. The [[project-wingman-live-hub]] pill now MORPHS through call end: Live → "Call saved — generating debrief…" → "Debrief ready — [View call →]" (persists until View-call click / ✕ dismiss / new deploy — no auto-fade, Sebastian's call) → fade. Inactivity/2-hr become amber pill SAFETY states (mic-off/clock icon, NO border change). View-call DEEP-LINKS to that call's Flight Log entry (new `navigate:call` rail) with a loading skeleton that fills as the debrief lands (FlightLogTab derives the open detail from the LIVE `calls` prop, not a frozen snapshot). Outcome AUTO-DETECTED by the post-call Sonnet job (same pass, `outcome:{value,confidence}`, conditional `.is("outcome",null)` write, `outcome_source='auto'` tag). New IPC: `hud:open-call` / `hud:morph-done` / `wingman:post-call-state`. HUD `hubPhase` state machine; morph driven by callId + `hud:auto-stopped` (NOT phase — `call:started` fires before initRecallAI resolves, so phase-based would false-morph a failed deploy). Stop chain UNTOUCHED (invariants #3/#4/#5 — notifications only).

**Close-rate rule (Sebastian-locked):** auto-marks EXCLUDED from close-rate until human-confirmed ("a wrong auto-guess must never poison stats"). Shared helper `src/lib/wingman/outcome-stats.ts` `confirmedOutcome()` applied across FlightLog + Home + Intel + Ask-Wingman (`ai/chat`) + Sales DNA moat (`rep-profile.ts`).

**DB:** `ALTER TABLE calls ADD COLUMN outcome_source text CHECK (outcome_source IN ('auto','manual'))` RAN in Supabase (Sebastian confirmed). Live `calls_outcome_check` = Closed|Lost|DQ|Follow Up|Set|No Show|Other. No migration FILE (matches existing out-of-band drift). Debrief-ready poll tightened 5s→2s (DashboardClient + FlightLogTab).

**STILL VERIFY on a real call:** auto-outcome tag on a clear close/loss (short test call abstained) · amber safety states (rendering verified only) · #52 cold-ladder dig gate on a real talking call.

**Deferred (post-launch, new-hire task):** streaming the debrief into the dashboard — design + durability catch (server job stays authoritative, stream via Supabase Realtime not a client-held SSE) in `_Inbox/2026-07-24 Streaming debrief into the dashboard (polish, post-launch).md`.

**Next release:** v0.1.29 desktop release ships this + the full held HUD bundle (Live Hub, close-readiness, backgroundThrottling). The poll-tightening reaches Railway on the next web merge.
