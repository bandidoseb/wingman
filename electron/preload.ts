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

// Expose the wingman API to the web app
contextBridge.exposeInMainWorld("wingman", {
  // ── Call lifecycle ──────────────────────────────────────────────────────
  /** Called when user starts a live call. Starts audio capture + shows HUD. */
  startCall: () => ipcRenderer.invoke("call:start"),

  /** Called when user ends a live call. Stops audio capture + hides HUD. */
  endCall: () => ipcRenderer.invoke("call:end"),

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
   * The web app registers a callback here; Electron calls it with each chunk.
   */
  onTranscriptChunk: (callback: (chunk: string) => void) => {
    ipcRenderer.on("transcript:chunk", (_event, chunk) => callback(chunk));
  },

  /** Remove the transcript listener (call this when component unmounts) */
  offTranscriptChunk: () => {
    ipcRenderer.removeAllListeners("transcript:chunk");
  },

  // ── Keyboard shortcut events ─────────────────────────────────────────────
  /**
   * Listen for F5/F6/F7 keypress (the "activation key").
   * User presses F5 → Electron fires this → web app starts/ends call.
   */
  onToggleCall: (callback: () => void) => {
    ipcRenderer.on("shortcut:toggle-call", () => callback());
  },

  offToggleCall: () => {
    ipcRenderer.removeAllListeners("shortcut:toggle-call");
  },

  // ── Signal dismiss (initiated from HUD window) ───────────────────────────
  /**
   * The HUD can dismiss signals. When the user hits Dismiss in the HUD,
   * main.ts fires "signal:dismiss" to the main window so the web app
   * state stays in sync.
   */
  onSignalDismiss: (callback: () => void) => {
    ipcRenderer.on("signal:dismiss", () => callback());
  },

  offSignalDismiss: () => {
    ipcRenderer.removeAllListeners("signal:dismiss");
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

  /** User is dragging the HUD — tell main process to move the window */
  moveWindow: (x: number, y: number) => ipcRenderer.invoke("hud:move", x, y),

  // ── Mouse interaction toggle ─────────────────────────────────────────────
  /**
   * Called by the HUD when the suggestion bubble appears or disappears.
   * ignore=true  → mouse clicks pass through (default, so the user can click Zoom etc.)
   * ignore=false → "Got it" button becomes clickable
   */
  setMouseIgnore: (ignore: boolean) =>
    ipcRenderer.invoke("hud:set-mouse-ignore", ignore),

  // ── Call lifecycle events from main process → HUD ───────────────────────
  /**
   * Fires when a call starts (call:started sent from main.ts).
   * HUD uses this to start its timer and show the live dot.
   */
  onCallStart: (callback: () => void) => {
    ipcRenderer.on("call:started", () => callback());
  },

  /**
   * Fires when a call ends (call:ended sent from main.ts).
   * HUD uses this to stop its timer and fade out.
   */
  onCallEnd: (callback: () => void) => {
    ipcRenderer.on("call:ended", () => callback());
  },

  // ── Detection toast ──────────────────────────────────────────────────────
  /**
   * Fires when Recall AI detects a meeting window (before the call starts).
   * HUD shows a branded "Wingman detected a call" toast.
   */
  onCallDetected: (callback: () => void) => {
    ipcRenderer.on("call:detected", () => callback());
  },

  /** User dismissed the detection toast without starting a call — hide HUD */
  dismissDetection: () => ipcRenderer.invoke("hud:dismiss-detection"),

  /**
   * Deploy button clicked in either the detection toast or manual trigger toast.
   * Tells main process to start the call via the web app's toggle handler.
   */
  deployCall: () => ipcRenderer.invoke("hud:deploy-call"),

  /**
   * Fires when Ctrl+Shift+W is pressed and no call is active.
   * HUD shows a "Ready to deploy Wingman?" confirmation toast.
   */
  onManualTrigger: (callback: () => void) => {
    ipcRenderer.on("hud:manual-trigger", () => callback());
  },

  /**
   * Fires when Ctrl+Shift+W is pressed during an active call.
   * HUD shows "End this call?" confirmation toast.
   */
  onEndCallConfirm: (callback: () => void) => {
    ipcRenderer.on("hud:end-call-confirm", () => callback());
  },

  /**
   * User clicked "End Call" in the confirmation toast.
   * Tells main process to end the call via the web app's toggle handler.
   */
  confirmEndCall: () => ipcRenderer.invoke("hud:confirm-end-call"),

  /**
   * Fires when Wingman auto-stops (inactivity, 2h cap, or meeting window closed).
   * HUD shows an informational toast explaining why it stopped.
   */
  onAutoStopped: (callback: (reason: string) => void) => {
    ipcRenderer.on("hud:auto-stopped", (_event, reason) => callback(reason));
  },

  /**
   * Fires 10 minutes before the 2-hour hard cap (at 1h 50m).
   * HUD shows a heads-up warning so the user isn't caught off guard.
   */
  onCapWarning: (callback: () => void) => {
    ipcRenderer.on("hud:cap-warning", () => callback());
  },
});
