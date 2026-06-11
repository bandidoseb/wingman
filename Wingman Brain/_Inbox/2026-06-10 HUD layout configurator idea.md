# HUD Layout Configurator (Sebastian idea — 2026-06-10)

Captured verbatim-ish from the #39 re-test session. Not scheduled — park until after Phase 3.5.

## The idea
A dashboard page where each user configures **where every HUD element appears on their screen**:
- A mock-up of their screen in the dashboard
- Either **drag** each individual HUD element (compass, signal card, outcome card, ambient dot) to where they want it…
- …or pick from **preset layouts**, with a live preview of what each preset looks like

## Why it came up
The compass currently appears bottom-left (inherited from the signal-card position research). Sebastian's instinct: bottom-right might fit better since the arrow keys are on the right side of the keyboard — and different reps will want different spots (Zoom self-view position, dock, multi-monitor setups all vary).

## Design notes for build time
- Interim step (cheap): a simple Settings dropdown — "HUD position: bottom-left / bottom-right" — before the full configurator. *(Parked 2026-06-10 — rejected as premature; see Decisions Log.)*
- Full version stores per-element positions in `profiles` (needs a schema migration → Sebastian approval).
- Electron side: HUD is a full-screen transparent overlay, so positioning is pure CSS coordinates sent over IPC — no window moves needed.
- Watch-outs: multi-display setups (HUD lives on the primary display), collision with Zoom's own UI (self-view bottom-right, controls bottom-center), and keeping elements fully on-screen at any resolution.
- Pairs naturally with the undetectability settings toggle (item 0d) as a "HUD preferences" Settings section.

## Status
Idea captured. The immediate compass-position question (left vs right vs toggle) was put to Sebastian as a decision during the 2026-06-10 session — see that day's build log for the outcome.
