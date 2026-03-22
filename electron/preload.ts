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
let _transcriptChunkHandler: ((_e: Electron.IpcRendererEvent, chunk: string) => void) | null = null;
let _signalDismissHandler:   ((_e: Electron.IpcRendererEvent) => void) | null = null;

// ─────────────────────────────────────────────────────────────────────────────

// Expose the wingman API to the web app
contextBridge.exposeInMainWorld("wingman", {
  // ── Call lifecycle ──────────────────────────────────────────────────────
  /** Called when user starts a live call. Starts audio capture + shows HUD. */
  startCall: (token?: string) => ipcRenderer.invoke("call:start", token),

  /** Called when user ends a live call. Stops audio capture + shows HUD outcome card. */
  endCall: (callId?: string, token?: string) => ipcRenderer.invoke("call:end", callId, token),

  // ── HUD control ─────────────────────────────────────────────────────────
  /** Show the floating HUD overlay */
  showHud: () => ipcRenderer.invoke("hud:show"),

  /** Hide the floating HUD overlay */
  hideHud: () => ipcRenderer.invoke("hud:hide"),

  /** Send the current signal to display in the HUD */
  sendSignal: (signal: { header: string; text: string; type: string }) =>
    ipcRenderer.invoke("hud:signal", signal),

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

  // ── Environment detection ────────────────────────────────────────────────
  /** True when running inside the Electron desktop app (not a browser tab) */
  isElectron: true as const,
});

// ── HUD-specific preload ────────────────────────────────────────────────────
// The HUD window also uses this preload, so we expose a "hud" namespace too.
// The HUD uses this to receive signals/scorecard from the main window.
contextBridge.exposeInMainWorld("hud", {
  /** Receive a new signal to display */
  onSignal: (callback: (signal: { header: string; text: string; type: string }) => void) => {
    ipcRenderer.on("hud:update-signal", (_event, signal) => callback(signal));
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
});
