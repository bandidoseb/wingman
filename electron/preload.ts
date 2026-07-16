/**
 * preload.ts — The secure bridge between Electron and the web app
 *
 * Think of this like a bouncer at a club.
 * The web app (renderer) can't talk directly to Electron (main process) —
 * it would be a security risk. Instead, this file exposes ONLY the specific
 * functions we decide are safe, and makes them available as window.wingman.
 *
 * The web app calls:  window.wingman.startCall()
 * This file sends:   ipcRenderer.invoke("call:start")
 * main.ts handles:   ipcMain.handle("call:start", ...)
 */

import { contextBridge, ipcRenderer } from "electron";

// ── Toggle-call event buffering ───────────────────────────────────────────────
// Race condition fix: IPC events can arrive before React mounts and registers
// its listener via onToggleCall(). We listen immediately (preload runs before
// the page) and buffer any early event so it replays the moment the web app
// calls onToggleCall(callback).
let _toggleCallback: (() => void) | null = null;
let _pendingToggle = false;

ipcRenderer.on("shortcut:toggle-call", () => {
  if (_toggleCallback) _toggleCallback();
  else _pendingToggle = true; // buffer until web app registers
});

// ── Auto-ended event buffering ────────────────────────────────────────────────
// Fired by main.ts when Recall AI stops the call (meeting ended, inactivity,
// 2h cap). Distinct from shortcut:toggle-call so the web app can patch the
// session WITHOUT calling window.wingman.endCall() again (avoids double-stop).
let _autoEndedCallback: (() => void) | null = null;

ipcRenderer.on("call:auto-ended", () => {
  if (_autoEndedCallback) _autoEndedCallback();
});

// ── Named IPC handler references ─────────────────────────────────────────────
// Stored so we can call ipcRenderer.removeListener(channel, handler) precisely.
// Using removeAllListeners(channel) is too broad — it would silently remove any
// other listener on the same channel, causing invisible breakage.
let _transcriptChunkHandler:  ((_e: Electron.IpcRendererEvent, chunk: string) => void) | null = null;
let _transcriptPartialHandler: ((_e: Electron.IpcRendererEvent, chunk: string) => void) | null = null;
let _signalDismissHandler:    ((_e: Electron.IpcRendererEvent) => void) | null = null;
let _outcomeUpdatedHandler:   ((_e: Electron.IpcRendererEvent) => void) | null = null;
// Phase 3: hotkey compass menu — main process sends the direction the rep picked
let _menuPickHandler:         ((_e: Electron.IpcRendererEvent, direction: string) => void) | null = null;
// Phase C: main's 2-min flow idle timer expired — renderer archives + resets its thread
let _flowExpiredHandler:      ((_e: Electron.IpcRendererEvent) => void) | null = null;
// #47: main pushes the Deploy phase (idle/searching/starting/live/stopping) so the
// dashboard button + HUD reflect it. Separate handler refs per surface (wingman/hud).
let _deployStateHandler:      ((_e: Electron.IpcRendererEvent, payload: { state: string; reason?: string }) => void) | null = null;
let _hudDeployStateHandler:   ((_e: Electron.IpcRendererEvent, payload: { state: string; reason?: string }) => void) | null = null;

// ─────────────────────────────────────────────────────────────────────────────

// Expose the wingman API to the web app
contextBridge.exposeInMainWorld("wingman", {
  // ── Call lifecycle ──────────────────────────────────────────────────────
  /** Called when user starts a live call. Starts audio capture + shows HUD. */
  startCall: (token?: string) => ipcRenderer.invoke("call:start", token),

  /** Called when user ends a live call. Stops audio capture + shows HUD outcome card. */
  endCall: (callId?: string, token?: string) => ipcRenderer.invoke("call:end", callId, token),

  // ── Deploy state machine (#47) ───────────────────────────────────────────
  /**
   * Subscribe to Deploy phase updates pushed by main:
   *   "idle" | "searching" | "starting" | "live" | "stopping"  (+ optional reason
   *   on terminal frames: no_meeting | no_auth | recording_failed | cancelled).
   * Drives the Deploy button's label/spinner/cancel affordance ONLY — never routing.
   */
  onDeployState: (callback: (payload: { state: string; reason?: string }) => void) => {
    if (_deployStateHandler) ipcRenderer.removeListener("deploy:state", _deployStateHandler);
    _deployStateHandler = (_e, payload) => callback(payload);
    ipcRenderer.on("deploy:state", _deployStateHandler);
  },
  offDeployState: () => {
    if (_deployStateHandler) {
      ipcRenderer.removeListener("deploy:state", _deployStateHandler);
      _deployStateHandler = null;
    }
  },
  /** Cancel an in-flight Deploy search (while "searching"). */
  cancelSearch: () => ipcRenderer.invoke("deploy:cancel-search"),

  // ── HUD control ─────────────────────────────────────────────────────────
  /** Show the floating HUD overlay */
  showHud: () => ipcRenderer.invoke("hud:show"),

  /** Hide the floating HUD overlay */
  hideHud: () => ipcRenderer.invoke("hud:hide"),

  /**
   * Send the authoritative signal to display in the HUD.
   * `seq` (streaming): a monotonic press id so a stale/late frame can't paint over a
   * newer card — the HUD ignores any signal whose seq is older than the one it's showing.
   */
  sendSignal: (signal: { header: string; text: string; type: string; seq?: number }) =>
    ipcRenderer.invoke("hud:signal", signal),

  /**
   * Streaming objection card (Step 4) — feed the HUD's constant-rate reveal loop.
   *   phase "start" → open the (headless) card shell + begin the reveal at seq
   *   phase "delta" → grow the revealed text to `textSoFar` (ignored if seq is stale)
   *   phase "done"  → mark the reveal complete with the final `textSoFar`
   *   phase "abort" → wipe a half-revealed line (mid-stream drop / dismiss / call-end)
   * The authoritative final frame still also arrives via sendSignal (carrying the same seq).
   */
  sendSignalDelta: (payload: { seq: number; phase: "start" | "delta" | "done" | "abort"; textSoFar?: string; type?: string; beliefTag?: string }) =>
    ipcRenderer.invoke("hud:signal-delta", payload),

  /**
   * Phase 3.5 — report summoned-card progress to the HUD's thinking pill.
   * "thinking"    → generation started (pill + live seconds counter)
   * "error"       → failed / timed out ("Couldn't pull that — tap ↑ to retry")
   * "unsupported" → arrow not built yet ("Not ready yet — coming soon")
   * Card arrival itself clears the pill (sendSignal → HUD showSignal).
   */
  sendSummonState: (payload: { state: "thinking" | "error" | "unsupported" | "idle"; slot?: string }) =>
    ipcRenderer.invoke("hud:summon-state", payload),

  /** Send scorecard state to HUD so it can display the live scoring */
  sendScorecard: (scorecard: Record<string, unknown>) =>
    ipcRenderer.invoke("hud:scorecard", scorecard),

  /** Tell the HUD which call stage we're currently in (full stage context) */
  sendStage: (data: { current: string; all: string[]; completed: string[] }) =>
    ipcRenderer.invoke("hud:stage", data),

  // ── Transcript from Recall AI ────────────────────────────────────────────
  /**
   * Listen for transcript chunks coming from Recall AI (audio → text).
   * These arrive automatically — no manual pasting needed.
   */
  onTranscriptChunk: (callback: (chunk: string) => void) => {
    // Remove any previous handler before adding the new one — prevents stacking
    // if this is called more than once (e.g. component remount).
    if (_transcriptChunkHandler) {
      ipcRenderer.removeListener("transcript:chunk", _transcriptChunkHandler);
    }
    _transcriptChunkHandler = (_event, chunk) => callback(chunk);
    ipcRenderer.on("transcript:chunk", _transcriptChunkHandler);
  },

  /** Remove the transcript listener (call this when component unmounts) */
  offTranscriptChunk: () => {
    if (_transcriptChunkHandler) {
      ipcRenderer.removeListener("transcript:chunk", _transcriptChunkHandler);
      _transcriptChunkHandler = null;
    }
  },

  /**
   * Listen for PARTIAL (unfinalized) transcript chunks (#41). Same
   * "Speaker: text" line format as finals, but the text is Deepgram's
   * in-progress read of the CURRENT utterance — it arrives ~126ms behind
   * speech and may be revised until the final lands. Used only for the
   * press-time live tail; never stored.
   */
  onTranscriptPartial: (callback: (chunk: string) => void) => {
    if (_transcriptPartialHandler) {
      ipcRenderer.removeListener("transcript:partial", _transcriptPartialHandler);
    }
    _transcriptPartialHandler = (_event, chunk) => callback(chunk);
    ipcRenderer.on("transcript:partial", _transcriptPartialHandler);
  },

  /** Remove the partial-transcript listener (call this when component unmounts) */
  offTranscriptPartial: () => {
    if (_transcriptPartialHandler) {
      ipcRenderer.removeListener("transcript:partial", _transcriptPartialHandler);
      _transcriptPartialHandler = null;
    }
  },

  // ── Keyboard shortcut / tray / HUD toggle ────────────────────────────────
  /**
   * Listen for the toggle-call signal (Ctrl+Shift+W, tray button, or HUD button).
   * Buffered: if the signal arrived before this is called, it fires immediately.
   */
  onToggleCall: (callback: () => void) => {
    _toggleCallback = callback;
    if (_pendingToggle) {
      _pendingToggle = false;
      callback(); // replay the event that arrived before the page was ready
    }
  },

  offToggleCall: () => {
    _toggleCallback = null;
  },

  // ── Auto-stop from Recall AI ─────────────────────────────────────────────
  /**
   * Fired when Recall AI ends the call automatically (meeting ended, inactivity,
   * 2h cap). The web app should patch the session WITHOUT calling endCall() again,
   * because Electron already stopped Recall AI in this path.
   */
  onAutoEnded: (callback: () => void) => {
    _autoEndedCallback = callback;
  },

  offAutoEnded: () => {
    _autoEndedCallback = null;
  },

  // ── Signal dismiss (initiated from HUD window) ───────────────────────────
  onSignalDismiss: (callback: () => void) => {
    if (_signalDismissHandler) {
      ipcRenderer.removeListener("signal:dismiss", _signalDismissHandler);
    }
    _signalDismissHandler = () => callback();
    ipcRenderer.on("signal:dismiss", _signalDismissHandler);
  },

  offSignalDismiss: () => {
    if (_signalDismissHandler) {
      ipcRenderer.removeListener("signal:dismiss", _signalDismissHandler);
      _signalDismissHandler = null;
    }
  },

  // ── Hotkey compass menu — direction picked by rep ────────────────────────
  /**
   * Fired by main.ts when the rep presses a direction key after summoning the
   * compass menu with Up Arrow. Direction is one of: "objection" | "answer" |
   * "dig" | "close". DashboardClient registers this once and calls the API.
   */
  onMenuPick: (callback: (direction: string) => void) => {
    if (_menuPickHandler) {
      ipcRenderer.removeListener("wingman:menu-pick", _menuPickHandler);
    }
    _menuPickHandler = (_event, direction) => callback(direction);
    ipcRenderer.on("wingman:menu-pick", _menuPickHandler);
  },

  offMenuPick: () => {
    if (_menuPickHandler) {
      ipcRenderer.removeListener("wingman:menu-pick", _menuPickHandler);
      _menuPickHandler = null;
    }
  },

  // ── Objection Flow mode (Phase C) ────────────────────────────────────────
  /** Thread opened/advanced (or threaded press) — main arms single-↑ mode + re-arms its 2-min idle timer. */
  flowOpened: () => ipcRenderer.send("flow:open"),

  /** Renderer reset its thread — main drops single-↑ mode (no echo back). */
  flowClosed: () => ipcRenderer.send("flow:close"),

  /** Fired by main when the flow's 2-min idle timer expires — archive + reset the thread ledger. */
  onFlowExpired: (callback: () => void) => {
    if (_flowExpiredHandler) {
      ipcRenderer.removeListener("wingman:flow-expired", _flowExpiredHandler);
    }
    _flowExpiredHandler = () => callback();
    ipcRenderer.on("wingman:flow-expired", _flowExpiredHandler);
  },

  offFlowExpired: () => {
    if (_flowExpiredHandler) {
      ipcRenderer.removeListener("wingman:flow-expired", _flowExpiredHandler);
      _flowExpiredHandler = null;
    }
  },

  /** Flow chrome for the HUD card — "MOVE #N" header + the press-↑ affordance. */
  sendFlowState: (payload: { active: boolean; move?: number }) =>
    ipcRenderer.invoke("hud:flow-state", payload),

  /**
   * → Close readiness chip (Design #2). Deterministic, client-scored — no card generation.
   *   state → one of not-ready | continue | almost | ready (drives the chip color + label)
   *   label → the two-word chip text
   *   gap   → up to 2 rep-facing belief names not yet covered ([] for "ready")
   *   seq   → shared monotonic press id (HUD ignores a stale frame, same as sendSignal)
   */
  sendReadiness: (payload: { state: string; label: string; gap: string[]; note?: string; seq: number }) =>
    ipcRenderer.invoke("hud:readiness", payload),

  // ── Zoom name status sync ────────────────────────────────────────────────
  /** Tells the main process whether the user has a Zoom display name set.
   *  Called on dashboard mount and whenever the name is saved in Settings. */
  setZoomStatus: (hasName: boolean) => ipcRenderer.invoke("app:set-zoom-status", hasName),

  // ── Outcome saved — tells dashboard to refresh so disposition pill appears ──
  onOutcomeUpdated: (callback: () => void) => {
    if (_outcomeUpdatedHandler) {
      ipcRenderer.removeListener("call:outcome-updated", _outcomeUpdatedHandler);
    }
    _outcomeUpdatedHandler = () => callback();
    ipcRenderer.on("call:outcome-updated", _outcomeUpdatedHandler);
  },

  offOutcomeUpdated: () => {
    if (_outcomeUpdatedHandler) {
      ipcRenderer.removeListener("call:outcome-updated", _outcomeUpdatedHandler);
      _outcomeUpdatedHandler = null;
    }
  },

  // ── Navigate to Settings (sent by main when HUD "Open Settings" is clicked) ──
  onNavigateToSettings: (callback: () => void) => {
    ipcRenderer.on("navigate:settings", () => callback());
  },

  // ── Environment detection ────────────────────────────────────────────────
  /** True when running inside the Electron desktop app (not a browser tab) */
  isElectron: true as const,
});

// ── HUD-specific preload ────────────────────────────────────────────────────
// The HUD window also uses this preload, so we expose a "hud" namespace too.
// The HUD uses this to receive signals/scorecard from the main window.
contextBridge.exposeInMainWorld("hud", {
  /** Receive a new signal to display */
  onSignal: (callback: (signal: { header: string; text: string; type: string; seq?: number }) => void) => {
    ipcRenderer.on("hud:update-signal", (_event, signal) => callback(signal));
  },

  /** Receive a streaming reveal delta (Step 4) — start / delta / done / abort. */
  onSignalDelta: (callback: (payload: { seq: number; phase: "start" | "delta" | "done" | "abort"; textSoFar?: string; type?: string }) => void) => {
    ipcRenderer.on("hud:update-signal-delta", (_event, payload) => callback(payload));
  },

  /** Receive scorecard update */
  onScorecard: (callback: (scorecard: Record<string, unknown>) => void) => {
    ipcRenderer.on("hud:update-scorecard", (_event, scorecard) => callback(scorecard));
  },

  /** Receive stage update (full context: current + all + completed) */
  onStage: (callback: (data: { current: string; all: string[]; completed: string[] }) => void) => {
    ipcRenderer.on("hud:update-stage", (_event, data) => callback(data));
  },

  /** Receive transcript chunk (for HUD's live transcript display) */
  onTranscriptChunk: (callback: (chunk: string) => void) => {
    ipcRenderer.on("transcript:chunk", (_event, chunk) => callback(chunk));
  },

  /** User clicked Dismiss inside the HUD — tell main process */
  dismissSignal: () => ipcRenderer.invoke("hud:dismiss"),

  // ── Mouse interaction toggle ─────────────────────────────────────────────
  setMouseIgnore: (ignore: boolean) =>
    ipcRenderer.invoke("hud:set-mouse-ignore", ignore),

  // ── Call lifecycle events from main process → HUD ───────────────────────
  onCallStart: (callback: () => void) => {
    ipcRenderer.on("call:started", () => callback());
  },

  onCallEnd: (callback: (data: { callId?: string }) => void) => {
    ipcRenderer.on("call:ended", (_event, data) => callback(data ?? {}));
  },

  // ── Detection toast ──────────────────────────────────────────────────────
  onCallDetected: (callback: () => void) => {
    ipcRenderer.on("call:detected", () => callback());
  },

  dismissDetection: () => ipcRenderer.invoke("hud:dismiss-detection"),

  deployCall: () => ipcRenderer.invoke("hud:deploy-call"),

  // ── Deploy state machine (#47) → HUD ─────────────────────────────────────
  /** Deploy phase pushed by main so the HUD toast shows Looking…/Starting… + Cancel. */
  onDeployState: (callback: (payload: { state: string; reason?: string }) => void) => {
    if (_hudDeployStateHandler) ipcRenderer.removeListener("deploy:state", _hudDeployStateHandler);
    _hudDeployStateHandler = (_e, payload) => callback(payload);
    ipcRenderer.on("deploy:state", _hudDeployStateHandler);
  },
  /** Cancel an in-flight Deploy search from the HUD. */
  cancelSearch: () => ipcRenderer.invoke("deploy:cancel-search"),

  onManualTrigger: (callback: () => void) => {
    ipcRenderer.on("hud:manual-trigger", () => callback());
  },

  onEndCallConfirm: (callback: () => void) => {
    ipcRenderer.on("hud:end-call-confirm", () => callback());
  },

  confirmEndCall: () => ipcRenderer.invoke("hud:confirm-end-call"),

  /** Send the picked outcome to main process to save via API */
  saveOutcome: (callId: string, outcome: string) =>
    ipcRenderer.invoke("hud:save-outcome", { callId, outcome }),

  /** Fired by main process after the outcome save attempt completes */
  onOutcomeSaved: (callback: (success: boolean) => void) => {
    ipcRenderer.on("hud:outcome-saved", (_event, success) => callback(success));
  },

  onAutoStopped: (callback: (reason: string) => void) => {
    ipcRenderer.on("hud:auto-stopped", (_event, reason) => callback(reason));
  },

  onCapWarning: (callback: () => void) => {
    ipcRenderer.on("hud:cap-warning", () => callback());
  },

  // ── Live Hub waveform — 0..1 loudness at ~25 Hz (registered once at HUD init) ──
  onAudioLevel: (callback: (level: number) => void) => {
    ipcRenderer.on("hud:audio-level", (_event, level: number) => callback(level));
  },

  // ── Setup required (Zoom display name not set — fired when deploy is attempted) ──
  onSetupRequired: (callback: () => void) => {
    ipcRenderer.on("hud:setup-required", () => callback());
  },

  // ── Open Settings — tells main to show the dashboard and navigate to Settings ──
  openSettings: () => ipcRenderer.invoke("hud:open-settings"),

  // ── Debug log relay (debug #39) — HUD messages print in the dev terminal ──
  log: (msg: string) => ipcRenderer.send("hud:log", msg),

  // ── Hotkey compass menu (Phase 3) ────────────────────────────────────────
  // main.ts sends these when the Up Arrow summon key opens / closes the menu.
  onMenuOpen: (callback: () => void) => {
    ipcRenderer.on("wingman:menu-open", () => callback());
  },
  onMenuClose: (callback: () => void) => {
    ipcRenderer.on("wingman:menu-close", () => callback());
  },

  // ── Phase 3.5: pick feedback + summon-state pill ──────────────────────────
  // pick-flash: main sends the picked direction the instant a menu key is hit.
  // The HUD flashes that arrow green and owns the compass teardown on the pick
  // path (main suppresses its menu-close send there).
  onPickFlash: (callback: (direction: string) => void) => {
    ipcRenderer.on("wingman:pick-flash", (_event, direction: string) => callback(direction));
  },
  // summon-state: relayed from DashboardClient via main — drives the pill.
  onSummonState: (callback: (payload: { state: string; slot?: string }) => void) => {
    ipcRenderer.on("wingman:summon-state", (_event, payload: { state: string; slot?: string }) => callback(payload));
  },

  // ── Objection Flow chrome (Phase C) ───────────────────────────────────────
  // Relayed from DashboardClient via main when a threaded card lands / the flow
  // ends — drives the "OBJECTION FLOW · MOVE #N" header + press-↑ affordance.
  onFlowState: (callback: (payload: { active: boolean; move?: number }) => void) => {
    ipcRenderer.on("wingman:flow-state", (_event, payload: { active: boolean; move?: number }) => callback(payload));
  },

  // ── → Close readiness chip (Design #2) ────────────────────────────────────
  // Relayed from DashboardClient via main when the rep presses → Close. Drives the
  // color + two-word label + (for not-ready states) the gap names + "↓ Dig deeper" CTA.
  onReadiness: (callback: (payload: { state: string; label: string; gap: string[]; note?: string; seq: number }) => void) => {
    ipcRenderer.on("hud:update-readiness", (_event, payload: { state: string; label: string; gap: string[]; note?: string; seq: number }) => callback(payload));
  },

  // Click a card's colored CTA (↓ Dig deeper / ↑ Next move) — routes through the SAME
  // wingman:menu-pick path the hotkey uses, so a mouse click == pressing the arrow.
  triggerPick: (direction: string) => ipcRenderer.invoke("hud:trigger-pick", direction),
});
