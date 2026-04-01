# Wingman Build Changelog

_This file is Claude's portable memory across sessions. Read it at the start of every session. Update it at the end of every session._

---

## Current Status
Wingman is actively in development. Core architecture is defined. Claude Code is the primary builder. Sebastian is non-technical — all commands must be explicit.

## Last Session
- **Date:** 2026-04-01
- **What was completed:**
  - Added `zoom_display_name` column to Supabase `profiles` table (SQL run by Sebastian, confirmed success)
  - Added `zoom_display_name?: string | null` to `Profile` TypeScript interface
  - Added editable Zoom Display Name field to SettingsTab — orange border + REQUIRED badge when empty, placeholder "e.g. Johnny Appleseed", helper text pointing to top-right corner of Zoom app, Save button appears on change, ✓ Saved confirmation on success
  - Gated the Deploy Wingman button — cannot start a call without a Zoom display name set. Error message shown if blank.
  - Wired `repSpeakerRef` in `useWingmanPoller` to use the Settings name as the authoritative rep identity — no more keyword triggers firing on the rep's own words
  - Lowercased speaker comparison so "TLG - Sebastian Perez" matches regardless of case differences
  - Fixed `extractProspectText` in `keyword-triggers.ts` — single-pass for loop, `colonIdx` computed once per line (was computed twice)
  - Fixed `repSpeakerRef` not resetting between calls — stale auto-detected speaker from Call 1 no longer carries into Call 2
  - Fixed clearing zoom name in Settings having no effect on the running hook
  - Fixed "✓ Saved" never showing on first save (was checking stale server prop)
  - Fixed save button permanently stuck if network throws (added try/catch/finally)
  - Fixed stale closure bug in `handleStartCall` — `savedZoomName` added to `useCallback` deps so the gate always reads current state
  - Lifted `savedZoomName` into client state in `DashboardClient` so the deploy gate updates immediately when user saves name in Settings (no page refresh required)
  - Removed unnecessary `position: "relative"` wrapper div around the input
  - All changes pushed to Railway and auto-deployed

- **What was attempted but didn't work (and why):** Nothing failed this session — all changes were planned, reviewed by 3 parallel agents, bugs caught and fixed before push.

- **Known issues going into next session:**
  - End-to-end transcript → signal card pipeline has NOT been tested on a live Zoom call. Signal cards not confirmed working yet. This is still #1 priority.
  - False meeting detection — Wingman sometimes detects a "meeting" when no Zoom call is open (unknown cause, possibly a background process). Not blocking but should be investigated.
  - Detection toast (Zoom call detected, deploy Wingman) does not appear if Wingman is already running when a new Zoom call opens. Only the initial detection works.
  - KB embedding latency 700ms–1800ms vs 200ms target — needs Redis cache or optimization (V2)
  - Stripe billing not fully wired
  - Playbook page not yet built

- **Next up:** Test the full end-to-end pipeline on a live Zoom call — Deploy Wingman → transcript chunks arrive → keyword triggers fire → signal card appears on HUD. This is the #1 priority before beta.

---

## Failed Approaches Log
_When something definitively doesn't work, Claude logs it here so future sessions don't waste time repeating the same dead ends._

| Date | What Was Tried | Why It Failed | What To Do Instead |
|------|---------------|---------------|--------------------|
| 2026-04-01 | Deriving `zoomNameDirty` from `profile.zoom_display_name` comparison | `profile` is a frozen server prop — it never updates after page load, so the comparison is always wrong after the first save | Keep `zoomNameDirty` as explicit state; sync `zoomDisplayName` to trimmed value on successful save |
| 2026-04-01 | Reading `profile.zoom_display_name` directly in the deploy gate | Same stale prop problem — gate would block deploy even after user saved their name in the same session | Lift into `savedZoomName` client state; SettingsTab calls `onZoomNameSaved` callback to keep it current |

---

## Build History
_A running log of completed work, newest first._

| Date | What Was Built / Changed |
|------|--------------------------|
| 2026-04-01 | Zoom Display Name setting — required field before deploying Wingman. Fixes keyword triggers firing on rep's own words. Full bug review pass: 9 issues caught and fixed before push. |
| 2026-04-01 | Fixed region mismatch (us-east-1 → us-west-2) in recall.ts and recall-upload-token route |
| 2026-04-01 | Fixed post-call SSL error (ERR_SSL_PACKET_LENGTH_TOO_LONG) — now uses x-forwarded-proto/host headers |
| 2026-04-01 | Lowered KB similarity threshold 0.78 → 0.65 (was returning 0 matches) |
| 2026-04-01 | Fixed keyword triggers never firing — extractProspectText was filtering for "prospect:" label which Recall AI never uses |
| 2026-04-01 | Updated OpenAI API key across Railway and .env.local |
| — | Initial CHANGELOG.md created |
