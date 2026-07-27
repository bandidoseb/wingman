# Post-Call Flow Redesign — SESSION-READY BRIEF (open this cold)

Decided with Sebastian 2026-07-24 (Session 2). Build in ONE fresh session. This touches the
call-end state machine (the riskiest choreography in the app) → **plan-reviewer BEFORE code,
wingman-reviewer on the diff, both mandatory.** Bundles into the held **v0.1.29 desktop release**
(all HUD/Electron chrome — same bundle as the Live Hub, close-readiness chip, backgroundThrottling).

## The problem (Sebastian, verbatim intent)
Ending a call today pops TWO HUDs: (1) a top-right "Wingman stopped." toast with an orange "!" —
pure noise, Granola does nothing like it; (2) the "How'd it go?" outcome card — colors he dislikes,
and outcome-capture doesn't belong on the HUD. He wants the call end to feel like Granola: quiet,
smooth, one surface, flows straight into "generating summary."

## LOCKED DECISIONS

### 1. Kill the auto-stop toast for normal ends — keep ONLY two safety states, as PILL states
- `meeting_lost` (normal Zoom end) + manual end → **NO toast, nothing pops.** The pill morph (below)
  IS the confirmation.
- `inactivity` (20-min) + `max_duration` (2-hr) fire while the rep may STILL be on the call →
  silent stop = rep thinks they're covered when they're not. These two survive — but as **states of
  the Live Hub pill**, not a separate toast:
  - "Wingman stopped — no talking for 20 min" (mic-off icon) · "Wingman stopped — 2 hour limit" (clock icon)
  - **Amber ICON only. NO amber/orange border** (Sebastian 2026-07-24: the thin orange outline
    "looks ugly"). Normal pill border. Fades out after ~8s.
- Delete: HUD `#autoStopToast` (COMPONENT 3D, electron/hud/index.html ~680/1153/1721) + its
  `showAutoStopToast` wiring from `hud:auto-stopped`. The `AUTO_STOP_MESSAGES` map's meeting_lost
  entry dies; inactivity/max_duration messages move to the pill.

### 2. Kill the HUD outcome card — outcome becomes a DASHBOARD action with AI auto-detect
(Re-confirms Sebastian's own 2026-07-11 S3 decision — Current Sprint queue #12.)
- Delete: HUD `#outcomeCard` (COMPONENT 4, ~787/1511) + `showOutcomeCard` + the `call:ended`
  callId trigger + `outcome-pill` CSS + `onOutcomeSaved` flow. Audit main.ts's outcome save IPC +
  `pendingOutcomeToken` — remove the whole rail if nothing else uses it (check poll/outcome route
  consumers first).
- **Auto-detect**: the post-call Sonnet job (post-call/route.ts) already reads the full transcript
  for grade/debrief — add outcome prediction to the SAME pass (near-zero added cost/latency).
  - Confident (explicit "I'm in / send the link" vs clear no) → auto-mark, chip shows a subtle
    "auto" tag. One click on the chip opens the picker to change it.
  - Not confident → leave UNMARKED + dashboard nudges un-dispositioned calls.
  - **Accuracy hard gate (Sebastian's standing rule): close rate counts ONLY marked calls** — a
    wrong auto-guess must never silently poison stats. Consider: does an "auto" mark count toward
    close rate, or only after human confirm? → decide with Sebastian at build (leaning: auto counts,
    since it's changeable + tagged; but ask).
- Existing outcome plumbing to reuse: `/api/wingman/outcome` route + vault/calls outcome column.

### 3. Live Hub pill MORPH — one pill carries the whole call end
The existing branded pill (Live Hub, PR #53: logo + waveform + hover cog + drag/persist +
content-protection) morphs through:
  **Live (waveform + cog)** → **"Call saved — generating debrief…" (spinner)** →
  **"Debrief ready — [View call →]"** → fades out.
- **Transition spec (Sebastian, verbatim intent):** SMOOTH — "no glitchy movements." The pill
  smoothly grows/shrinks to the next state's size while old words fade OUT and new words fade IN,
  synced with the size motion. One continuous movement. CSS transitions on width/padding +
  opacity crossfade (pill is plain HTML/CSS in the HUD).
- **"View call →" is a real BUTTON** — a filled pill-segment on the RIGHT side of the pill
  (see the approved mockup: filled dark capsule inside the pill, arrow icon).
- Clicking the pill during "generating" ALSO opens the call entry (debrief fills in live).
- Fade-out timing after "ready": pick at build (suggest ~60s or on-click, ask Sebastian).

### 4. Deep-link: open THAT call's Flight Log entry (Granola screenshot = the reference)
- Today the dashboard opens on the home page. Instead: View-call → dashboard navigates DIRECTLY
  to the specific call in the Flight Log.
- Needs a small routing addition — the Flight Log has no "open call X from outside" today.
  Likely: query param (e.g. `/dashboard?tab=flightlog&call=<id>`) + an IPC from main
  (`mainWindow.show()` + navigate message) — DashboardClient/FlightLogTab consume it.
- **Skeleton fill-in (Sebastian 2026-07-24, Granola reference):** the call entry renders a
  loading-SKELETON layout immediately (transcript may already be there) and each debrief section
  smoothly fills in as the post-call job's results land. No blank page, no jump-in. Granola's
  post-call "generating" animation is the bar.

## The choreography being edited (read before coding)
- `electron/main.ts autoStopCall()` (~388): sends `call:ended` + `hud:auto-stopped` + 4s
  `hudAutoHideTimer`. The 4s toast-grace timer logic changes meaning once the toast dies —
  re-derive what the HUD needs at end (pill morph timing) and KEEP the outcome-card cancel
  interplay in `call:end` (~780) in mind while deleting it.
- **Architectural invariants #3/#4/#5 (CLAUDE.md) apply in full** — stop flows must stay
  single-path through stopRecallAI/autoStopCall. This redesign changes NOTIFICATIONS, never the
  stop chain itself.
- HUD `onCallEnd` (~2573): keeps setLive(false)/hideSignal/compass/pill cleanup; loses the
  outcome-card branch; gains the morph trigger.
- "Generating debrief" state needs a REAL signal for "debrief ready" — the post-call job is
  fired/polled by the web app; the pill needs main/renderer to learn completion (poll the call
  record? IPC from renderer when post-call resolves? decide in plan).
- The call-end LAG (Recall meeting_lost detection, a few seconds, SDK-bound) is accepted —
  invisible once nothing pops.

## Files (expected)
electron/main.ts · electron/hud/index.html (toast + outcome card deletion, pill states/morph) ·
electron/preload.ts (IPC surface) · src/app/api/wingman/post-call/route.ts (outcome prediction) ·
src/app/(dashboard)/dashboard/DashboardClient.tsx + src/components/dashboard/FlightLogTab.tsx
(deep-link routing, outcome chip + picker + auto tag, skeleton) · possibly outcome route.

## Gates
plan-reviewer (before code) · typecheck web+electron · 194+ vitest · wingman-reviewer ·
Sebastian live-test (end a real call: no toast, pill morphs smoothly, View call lands on the
entry, skeleton fills) · then cut v0.1.29 with the full HUD bundle.
