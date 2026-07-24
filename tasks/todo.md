# Post-Call Flow Redesign — HARDENED PLAN (plan-reviewed 2026-07-24)

Brief with locked decisions: `tasks/plan-post-call-flow.md`. Branch: `feat/confrontation-dial`
(held-local integration branch). Bundles into desktop release v0.1.29.
plan-reviewer verdict: NEEDS REVISION → all findings (SEV-1…9) folded in below.
Prior todo (#52/#53, complete) superseded — narrative lives in `Wingman Brain/01 - Build Log/2026-07-24.md`.

**Invariants #3/#4/#5 apply: this changes NOTIFICATIONS only — the stop chain
(stopRecallAI / autoStopCall / deployEpoch) is never touched.**

---

## Reviewer catches that reshaped the plan (why it looks this way)

1. **SEV-1 (would have shipped a bug):** `main.ts:707` sends `call:started` to the HUD BEFORE
   `await initRecallAI()` resolves — so on a failed deploy the HUD thinks it's live, and my original
   "morph if phase===live" rule would show "generating debrief…" for a deploy that never started.
   → Morph triggers are now driven by **callId + `hud:auto-stopped`**, never by phase alone.
2. **SEV-3:** DashboardClient's 2-min skeleton valve would kill the "ready" watcher before the
   post-call job's ~4.3-min worst case (4×60s attempts + backoff) → "View call" would silently never
   appear on slow runs. → Ready-watcher decoupled from the valve; pill timeout 6 min.
3. **SEV-5:** `FlightLogTab.selectedCall` is a frozen useState snapshot — the open detail view never
   re-reads the `calls` prop, so the skeleton would never fill in. → Detail view derives find-by-id
   from the live prop.
4. **SEV-4:** the live `calls.outcome` CHECK constraint has drifted from the migration (UI writes
   'No Show' + free text; migration only allows Closed/Lost/DQ/Follow Up/Set) and supabase-js does
   NOT throw on constraint violations. → Pre-build constraint verify + error-checked atomic write.

---

## Checklist

### Phase 0 — Pre-build verify (Sebastian runs in Supabase SQL editor, ~30s)
- [x] 0.1 Live `calls_outcome_check` = `outcome IN ('Closed','Lost','DQ','Follow Up','Set','No Show','Other')`.
      → AI auto-detect emits ONLY `Closed | Lost | Follow Up | DQ | No Show` (Set/Other excluded —
      not confidently inferrable). All are constraint-legal.
- [x] 0.2 Schema change RAN (Sebastian confirmed 2026-07-24): `outcome_source` column added.

### Phase 1 — Electron main (`electron/main.ts`)
- [x] 1.1 `autoStopCall()` (~388): keep every send unchanged; replace the 4s `hudAutoHideTimer` hide
      with a ~7-min safety-net hide (normal hide path becomes `hud:morph-done`).
- [x] 1.2 `call:end` handler (~756): drop `pendingOutcomeCallId/Token` writes + outcome-card
      keep-alive logic (779–787); keep `call:ended {callId}`; keep hudWindow shown; arm safety net.
- [x] 1.3 `call:start` handler: clear the safety-net timer at claim time (top) — otherwise call N+1
      deployed inside call N's 7-min window gets its HUD hidden mid-call (SEV-6).
- [x] 1.4 Delete the `hud:save-outcome` handler + `pendingOutcomeCallId`/`pendingOutcomeToken` rail
      (write-only dead state confirmed).
- [x] 1.5 New handlers: `hud:open-call {callId|null}` (clone `hud:open-settings`: show/focus/create
      mainWindow + send `navigate:call {callId}`; hide HUD after) · `hud:morph-done` (clear safety
      net + hide hudWindow) · `wingman:post-call-state` (validate payload, guard
      `!hudWindow.isDestroyed()`, relay as `hud:post-call-state`).

### Phase 2 — Preload + types (`electron/preload.ts`, `src/types/index.ts`)
- [x] 2.1 wingman: add `postCallState(payload)` invoke + `onNavigateToCall(cb)` — **buffered** like
      `shortcut:toggle-call` (preload:24–27), not unbuffered like `navigate:settings` (SEV-8).
- [x] 2.2 hud: add `openCall(callId)`, `morphDone()`; remove `saveOutcome`/`onOutcomeSaved`.
- [x] 2.3 Keep `endCall(callId, token)` signature (old-preload compat; new main ignores token).
      Keep `onOutcomeUpdated` (old v0.1.28 apps still send it).
- [x] 2.4 `Call` type: add `outcome_source?: 'auto' | 'manual' | null`.

### Phase 3 — HUD pill morph (`electron/hud/index.html`)
- [x] 3.1 DELETE `#autoStopToast` (HTML 1153–1159, refs 1506–1507, `showAutoStopToast` +
      `AUTO_STOP_MESSAGES` + timer 1721–1739, listener 2609). Keep shared `.wingman-toast` CSS.
- [x] 3.2 DELETE `#outcomeCard` (CSS 786–901, HTML 1182–1196, state 1275–1277, refs,
      show/hide 1511–1553, save flow 1556–1566, `onOutcomeSaved` 2586–2602, hover-list entry 2288,
      `setLive(true)` cancel 1817–1822).
- [x] 3.3 `hubPhase` state machine — hidden | starting | live | generating | ready | safetyStopped:
      · `onCallEnd(data)`: callId truthy → **generating** (store callId, 6-min timeout).
        No callId → light teardown only, 400ms grace timer, NO phase change (failed-start/session-fail
        sends `call:ended {}` — must not morph; SEV-1).
      · `onAutoStopped('meeting_lost')` → **generating** (callId arrives via post-call-state).
      · `onAutoStopped('inactivity'|'max_duration')` → **safetyStopped**: amber ICON only (mic-off /
        clock), NO border change, message text, ~8s → `hubFadeOut`. Terminal: clears generating
        timeout, IGNORES all post-call-state (renderer can't tell reasons apart — HUD must gate; SEV-2).
      · `post-call-state{generating, callId}` → attach callId only (adopt only if phase===generating).
      · `post-call-state{ready, callId}` → **ready** only if phase===generating AND callId matches
        (stale ready for call N must not fire during call N+1; SEV-6).
      · `deploy:state 'searching'|'starting'` → reset ALL morph phases + timers → starting.
      · `deploy:state 'idle'|'stopping'` → hide only if phase===starting; IGNORE during
        generating/ready/safetyStopped (idle fires around call:ended and would kill the morph).
      · generating 6-min timeout / safetyStopped 8s → quiet `hubFadeOut` →
        `restoreHubPassThrough()` + `hud.morphDone()`.
      · **ready PERSISTS (Sebastian 2026-07-24): no auto-fade.** Exits only via View-call click,
        a hover-reveal mini ✕ (✕-circle style from PR #50), or a new deploy. Both exits →
        `hubFadeOut` + `morphDone`. Main clears the 7-min safety-net hide when it relays a valid
        `ready` (window must not vanish under a persisting pill); safety net still covers
        generating-phase hangs.
- [x] 3.4 Morph UI: `#hubText` span + `#hubButton` filled capsule ("View call →") as flex children;
      animate child width/opacity like the `#hubCog` pattern (fixed 34px height, content-driven
      width); spinner for generating; waveform+cog crossfade out in morph phases. Keyframe named
      `hubFadeOut` — NEVER `fadeOut` (collides with global keyframe at 146).
- [x] 3.5 Clicks: generating-phase pill click AND ready-phase button click → `hud.openCall(callId)`
      (null-safe → opens Flight Log tab without selection). Hover-capture already works (2352–2359).
- [x] 3.6 Split `setLive(false)`: always light teardown (stopTimer, signal, compass, thinking pill,
      audio wave); `hideHub()` only when resolved next phase is hidden.

### Phase 4 — Post-call outcome auto-detect (`src/app/api/wingman/post-call/route.ts` + outcome routes)
- [x] 4.1 Extend the SAME Sonnet pass: `outcome: {value: <live-constraint enum>|null, confidence:
      'high'|'low'}` placed EARLY in the JSON schema; prompt rule: 'high' only on explicit verbal
      commitment/refusal; ambiguity → null/low. Bump `max_tokens` 1536 → ~1900 (truncation kills the
      whole JSON.parse; SEV-7).
- [x] 4.2 Atomic conditional write BEFORE the summary write:
      `.update({outcome, outcome_source:'auto'}).eq('id',call_id).eq('user_id',user.id).is('outcome',null)`
      — only when confidence==='high' && value non-null && value ∈ live constraint set. READ + log
      `error` (supabase-js doesn't throw on CHECK violations). 0 rows affected = manual pick won, fine.
- [x] 4.3 `/api/wingman/outcome` + `/api/wingman/hud-outcome`: also set `outcome_source:'manual'`.
      hud-outcome route otherwise UNTOUCHED (v0.1.28 HUDs still call it; Phase-5 removal later).

### Phase 5 — Dashboard (`DashboardClient.tsx`, `FlightLogTab.tsx`)
- [x] 5.1 Skeleton-clear condition (648–655): `outcome && summary` → **summary-only** (outcome no
      longer guaranteed to ever arrive).
- [x] 5.2 `handleEndCall`/`handleAutoEnd`: after session PATCH → `postCallState?.({phase:'generating',
      callId})` (optional-chained — old preloads lack it).
- [x] 5.3 NEW decoupled ready-watcher: own ref for the generating callId, ~6-min horizon, watches
      `initialCalls` for that id's `summary` → `postCallState?.({phase:'ready', callId})`. NOT gated
      on the 2-min `pendingOutcome` valve (SEV-3).
- [x] 5.4 `onNavigateToCall(id)` → `setTab('library')` + pass `pendingCallId` down.
- [x] 5.5 FlightLogTab: accept `initialCallId`; **derive the open detail view from the live `calls`
      prop by id** (not a frozen snapshot — SEV-5) so debrief/stages/coverage crossfade in as
      router.refresh lands them; skeleton shimmer for missing sections; keep a 5s refresh loop while
      the deep-linked row/summary is missing (cap ~6 min).
- [x] 5.6 Outcome chip: `OutcomeBadge` + subtle 'auto' tag when `outcome_source==='auto'`; click
      opens existing picker; manual save flips source (route-side). Verify the server component's
      calls SELECT includes `outcome_source`.
- [x] 5.7 Close-rate math (Sebastian-locked 2026-07-24): EXCLUDE `outcome_source==='auto'` calls
      until human-confirmed. Confirm = clicking the auto chip → picker → any pick saves as manual
      (legacy calls have outcome_source NULL → count as before). Sweep EVERY close-rate
      computation: FlightLogTab:645 + HomeTab stats (grep for others).

### Phase 6 — Gates
- [x] 6.1 `npm run typecheck` (web) + electron typecheck.
- [x] 6.2 Full vitest suite (194+). New unit coverage where extractable (pill state-machine
      transition table as a pure module if practical).
- [x] 6.3 wingman-reviewer on the full diff.
- [ ] 6.4 Sebastian live-test: end a real call → no toast · pill morphs Live→generating→ready
      smoothly · View call lands on the entry · skeleton fills in · auto outcome appears tagged (or
      stays unmarked) · inactivity path shows amber pill state · back-to-back calls reset cleanly.

## Version-skew matrix (verified safe)
- NEW web + OLD app v0.1.28: old HUD keeps its toast + outcome card (hud-outcome route alive);
  new web methods optional-chained. No breakage.
- NEW app + OLD web: doesn't occur (Railway first); pill 6-min timeout covers it anyway.

## Decisions (Sebastian 2026-07-24)
1. ✅ Auto outcomes shown tagged but EXCLUDED from close-rate math until human-confirmed.
2. ✅ Ready pill persists until View-call click or mini ✕ dismiss (no auto-fade).
3. ⏳ `outcome_source` column (0.2) + constraint check (0.1) — awaiting explicit yes.
