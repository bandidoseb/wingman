# Plan — #47 Deploy is flimsy / spammable → explicit Deploy state machine (HARDENED post plan-review)

**Goal:** Make Deploy feel Granola-solid. Press once → instant feedback, waits for the call if detection hasn't landed, auto-starts the moment it's found, and mashing the button can NEVER put the app in a broken state or tear down a live call.

**Status:** Plan hardened after plan-reviewer (verdict was NEEDS REVISION → all findings folded in below). Awaiting Sebastian's two decisions + go-ahead. No code yet.

---

## What we proved (2026-07-10 instrumented test calls, Known Issue #47)

1. Detection is event-driven and DOES fire on its own (World A) — not permanently stuck.
2. **The real bug is a concurrency race, not just latency.** Spamming Deploy fired ~17 `call:start` in 2.5s. One press succeeded, then a *later* press hit the `isRunning`/`isStarting` guard inside `initRecallAI()` → returned `false` → the caller ran its **failure-rollback** (`callActive=false`, `unregisterCallHotkey()`, `call:ended`) **on top of the live call**, tearing it down. Call ended in ~2s, no transcript. That's the "flimsy" feeling.
3. A calm single press works flawlessly. Foundation is sound — polish, not rebuild.
4. Root cause: **`initRecallAI()` returns `false` for two different reasons — genuine start-failure AND "already starting/running" — and `call:start` treats both as failure and rolls back shared state.**

Secondary/cosmetic: `representedObject is not a WeakPtr…` log spam = macOS tray-menu noise from rapid `tray:call-state` flips during the spam. Should vanish once presses stop flipping state; verify after.

---

## Architecture (mapped)

Every start entry point funnels into ONE choke point — `call:start` in `electron/main.ts`:
- Dashboard button → `handleStartCall()` → `call:start`
- Tray Deploy → `tray:deploy` → `shortcut:toggle-call` → renderer `onToggleCall` → `handleStartCall` → `call:start`
- Tray menu / `Ctrl+Shift+W` / HUD detection toast → `shortcut:toggle-call` or `hud:deploy-call` → same
`onToggleCall` (renderer) decides start vs end from `isActiveRef`. **`call:start` has NO re-entrancy guard.** End path already shares `isEndingRef`; start path has no equivalent.

Load-bearing flags: `callActive` (main), `isRunning`/`isStarting` (recall.ts), renderer `isActive`. Architectural Invariants #2/#3/#4/#5 govern them — the fix must respect all.

---

## The fix — single-owner Deploy state machine + generation token

Main process owns the authoritative lifecycle (every entry point already routes through main):

```
type DeployState = 'idle' | 'searching' | 'starting' | 'live' | 'stopping';
let deployState: DeployState = 'idle';
let deployEpoch = 0;   // ← the piece the first draft missed. Bumped by cancel / call:end / autoStopCall.
```

**Why the epoch:** `call:start` has two long awaits (`waitForMeeting`, `initRecallAI`). The entry check+set is race-safe (synchronous, no await between), but a *suspended* handler resuming after a cancel/auto-stop/new-press is NOT. The epoch is captured at claim time and re-checked after every await; if it changed, someone else now owns the lifecycle and this handler bails **without touching `deployState`**.

Single writers (helpers):
- `pushDeployState(state, reason?)` — the ONLY place that sends `deploy:state` to renderer **and** HUD. Called on every transition.
- `resetDeploy(reason?)` — `deployState='idle'` + `pushDeployState('idle', reason)`. The ONLY way to return to idle from `call:start`'s own exits.

### `call:start` (rewritten)
```
// CLAIM (synchronous, race-safe)
if (deployState !== 'idle') return { success:false, error:'busy' };   // no-op; no state touched
deployState = 'searching';
const myEpoch = deployEpoch;
hudWindow?.show();
pushDeployState('searching');

// TOKEN CHECK (after claim → must reset on exit)
if (!token) { resetDeploy('no_auth'); return { success:false, error:'no_auth' }; }

// ARM-AND-WAIT
if (!hasMeetingDetected()) {
  const found = await waitForMeeting(SEARCH_TIMEOUT_MS);
  if (myEpoch !== deployEpoch) return { success:false, error:'superseded' };   // cancel/auto-stop/new press won — do NOT touch state
  if (!found) { resetDeploy('no_meeting'); return { success:false, error:'no_meeting' }; }
}

// START
deployState = 'starting'; pushDeployState('starting');
callActive = true;
const started = await initRecallAI({...unchanged...});
if (myEpoch !== deployEpoch) return { success:false, error:'superseded' };     // auto-stop during init already owns reset; skip hotkey + skip success → renderer skips session POST
if (!started) { /* existing rollback */ resetDeploy('recording_failed'); return { success:false, error:'recording_failed' }; }

// LIVE
deployState = 'live'; registerCallHotkey(); pushDeployState('live');
return { success:true };
```

### `call:end`
- Entry: `deployState='stopping'`, `pushDeployState('stopping')`, **`deployEpoch++`** (supersede any in-flight `call:start`).
- After `stopRecallAI()`: `deployState='idle'`, `pushDeployState('idle')`.

### Auto-stop chain (`autoStopFn → autoStopCall → stopRecallAI` — Invariant #5)
- In **`autoStopCall`** (the caller, NOT inside `stopRecallAI` — Invariant #3): **`deployEpoch++`**, `cancelWaitForMeeting()`, and after `stopRecallAI()` → `deployState='idle'`, `pushDeployState('idle', reason)`. Only ADDS a reset in the caller; never bypasses `stopRecallAI`.

### Cancel (`hud:cancel-search` + renderer `cancelSearch()`)
- **`deployEpoch++`**, `cancelWaitForMeeting()`, `deployState='idle'`, `pushDeployState('idle','cancelled')`, hide HUD if it was only showing the search state. (The epoch bump is what distinguishes cancel from timeout — the resumed handler bails via `superseded`, so NO false "no call found".)

### Detection toast + tray gate reconciliation
- `setupRecallAI` callback: guard `call:detected` with `if (deployState !== 'idle') return` — no redundant "Deploy" toast while already searching/starting.
- Remove the `hasMeetingDetected()` pre-gate in `tray:deploy` so tray Deploy funnels into the same arm-and-wait as dashboard/HUD (keep the `zoomNameSet===false` gate). One uniform "press once, it waits" behavior across all entry points.

---

## New helpers — `electron/recall.ts`
```
let meetingWaiter: { resolve:(v:boolean)=>void; timer:ReturnType<typeof setTimeout> } | null = null;
export function waitForMeeting(timeoutMs:number): Promise<boolean> {
  if (detectedWindowId !== null) return Promise.resolve(true);
  if (meetingWaiter) { clearTimeout(meetingWaiter.timer); const r=meetingWaiter.resolve; meetingWaiter=null; r(false); }
  return new Promise(res => { const t=setTimeout(()=>{ meetingWaiter=null; res(false); }, timeoutMs); meetingWaiter={resolve:res,timer:t}; });
}
export function cancelWaitForMeeting(): void {
  if (meetingWaiter) { clearTimeout(meetingWaiter.timer); const r=meetingWaiter.resolve; meetingWaiter=null; r(false); }
}
```
`meeting-detected` handler: after `detectedWindowId = evt.window.id`, resolve+clear the waiter, THEN `onMeetingDetected?.()`. Do NOT touch `isRunning`/`isStarting`/`stopRecallAI` (Invariants #2/#3).

Also: **remove all `#47-PROBE` instrumentation** (module `sdkReadyAt`, the two probe logs, the `meeting-updated` diagnostic listener, `probeDetectionState`) and its import/call in `main.ts` — it was diagnostic scaffolding, gone before ship.

---

## UI feedback — renderer + HUD
- **`deploy:state` drives label/affordance ONLY. `onToggleCall` keeps routing on `isActive` only** (never on `deploy:state`) — one router, no dual source of truth for routing.
- **`DashboardClient.tsx`:** add `isStartingRef` guard to `handleStartCall` (set at entry, cleared in a `finally` covering ALL ~5 exits, mirroring `isEndingRef`). Subscribe to `deploy:state` → a `deployPhase` useState (`idle`/`searching`/`starting`). Defensive: force `idle` whenever `isActive===true` or on `no_meeting`/`cancelled`/`recording_failed` — a single dropped IPC frame can't strand the label. Map `busy`+`superseded` → **silent no-op** (no error banner); keep `no_meeting`/`no_auth`/`recording_failed` messages. Wire Cancel during `searching` → `window.wingman.cancelSearch()`.
- **`HomeTab.tsx`:** accept `deployPhase` prop — `searching`="Looking for your call…" + Cancel + spinner + disabled; `starting`="Starting…" + disabled; else existing Deploy/End driven by `isActive`.
- **`electron/hud/index.html`:** detection/manual toasts reflect `deploy:state` (`searching`/`starting`) + Cancel wired to `window.hud.cancelSearch()`; an `idle` frame restores idle toast.
- **`preload.ts`:** `window.wingman` gets `onDeployState(cb)`/`offDeployState()` + `cancelSearch()`; `window.hud` gets `onDeployState(cb)` + `cancelSearch()`.
- **`src/types/index.ts`:** extend `window.wingman`/`window.hud` types; `startCall` return `error: 'busy'|'superseded'|'no_meeting'|'no_auth'|'recording_failed'`.

---

## Files to touch (exhaustive)
1. `electron/recall.ts` — waiters; resolve in `meeting-detected`; remove probe.
2. `electron/main.ts` — `deployState`+`deployEpoch` machine, `pushDeployState`/`resetDeploy`, epoch checks, `call:end`/`autoStopCall` resets, `hud:cancel-search`, tray pre-gate removal, toast guard, remove probe import.
3. `electron/preload.ts` — `onDeployState`/`cancelSearch` on `wingman` + `hud`.
4. `src/app/(dashboard)/dashboard/DashboardClient.tsx` — `isStartingRef`, `deployPhase`, reason mapping, Cancel.
5. `src/components/dashboard/HomeTab.tsx` — button phases.
6. `electron/hud/index.html` — toast phases + Cancel.
7. `src/types/index.ts` — type surface.

---

## Recommended shipping split (revised — the plan-reviewer killed the original Phase 1)
The original "Phase 1 = files 1,2,7" is UNSAFE: it introduces the `busy` return but excludes the renderer, so during a spam the successful deploy would flash "Failed to start" for presses 2–N. Correct split:
- **Unit A (the actual bug fix — ship as ONE unit):** guard + **epoch** + honest rollback + all exit resets + renderer `busy`/`superseded` silent no-op + `isStartingRef`. Files 1,2,4,7. Fully fixes the teardown/flimsy bug and can't strand state.
- **Unit B (fast follow — the Granola feel):** arm-and-wait + cancel + full HUD/tray UI + tray pre-gate removal + toast guard. Files 3,4,5,6.
Recommendation: build A+B together (one coherent change), but A is the safe standalone if we want the correctness fix in users' hands first.

---

## Blast-radius / failure-mode table (post-hardening)
- Spam/double-press → `busy` no-op, no state change, no teardown. ✅
- Cancel during `waitForMeeting` → epoch bump; resumed handler bails `superseded` (no false "no call found"); Cancel path owns reset. ✅
- New press during another's wait → first is superseded cleanly; second owns the search. ✅
- Auto-stop during `initRecallAI` → `autoStopCall` bumps epoch + resets; resumed handler bails `superseded`, skips hotkey + skips success → renderer skips session POST → **no `'live'`-with-dead-call, no orphaned DB session, no wasted spend.** ✅
- `no_auth`/timeout/`recording_failed` → each resets via `resetDeploy()` → never stranded. ✅
- Detection never comes / SDK crash mid-search (`isRunning===false`, crash handler no-ops) → `SEARCH_TIMEOUT_MS` timeout → clean "no call found" + reset. ✅
- Dropped `deploy:state` frame → renderer forces `idle` when `isActive===false`/on terminal reasons. ✅
- 2nd/5th/10th run → every terminal path returns to idle. ✅
- Invariants: #2 (isRunning only post-startRecording) untouched; #3 (`stopRecallAI` single stop) — resets live in callers only; #4 (callActive/isRunning together) — unchanged in recall.ts, and epoch prevents the `live`/`callActive` split; #5 (auto-stop chain) — only ADD a reset in `autoStopCall`. ✅

---

## Test plan (live) — `npm run electron:dev`, wait for `[kb-memory] ✅ ready` first
1. Happy single press → Live in ~1s, one session POST, compass works, no teardown.
2. **Spam repro:** mash Deploy ~15× → one start, rest log `busy`, call goes Live and STAYS live, transcript flows, no "Recording Stopped" cascade, **no false "Failed to start" banner**, no `representedObject` spam.
3. Press-before-detection → "Looking for your call…" → auto-starts on detection. Single press.
4. No call open → "Looking…" → after timeout "No call found — open Zoom/Meet/Teams," resets.
5. Cancel while searching → resets immediately, **no** "no call found" message.
6. New press while a search is active → clean handoff, no dupes.
7. Auto-stop (close Zoom window) mid-call → back to idle, no orphaned session (check no stray `POST /session`), Deploy works again.
8. Tray Deploy + Ctrl+Shift+W + HUD toast → all show the same searching/starting feedback.
9. Back-to-back 1→7→1 without restart → every start clean.
10. `npx tsc --noEmit` both tsconfigs clean; run `wingman-reviewer` on the diff.

---

## Decisions (LOCKED 2026-07-10 by Sebastian)
1. **Search timeout = 30s**, with a **"still looking…" nudge at ~15s** (renderer/HUD-owned local timer on receiving `searching`, cleared on `starting`/`live`/`idle`). `SEARCH_TIMEOUT_MS = 30_000`, `STILL_LOOKING_MS = 15_000`.
2. **Ship A+B together** — one PR: bulletproof anti-spam + arm-and-wait + full feedback across dashboard/tray/hotkey.

## Out of scope (deferred)
- Active-scan acceleration via `dumpAllApplications()` — only if packaged-app latency proves high; the event fires, so not needed now.
- Broader dashboard solidity sweep — separate deferred session.
