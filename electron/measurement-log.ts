/**
 * measurement-log.ts — #41 partials instrumentation + Flight Recorder main-process feed.
 *
 * Session-scoped JSONL logger. While a call is recording, every transcript event
 * (partial + final), every hotkey press, and every Recall lifecycle event is
 * appended as one JSON line to:
 *
 *   <userData>/partials-measurement/call-<timestamp>.jsonl   (always — #41)
 *   <repo>/dev-logs/call-<timestamp>.main.jsonl              (DEV-ONLY — Flight Recorder)
 *
 * The dev-logs copy is the MAIN-process feed of the Flight Recorder (spec:
 * tasks/plan-flight-recorder.md). It carries what the server + renderer can't see:
 * Deepgram partials, hotkey presses, and Recall lifecycle. It is correlated to the
 * server's call-<callId>.server.jsonl via a `recorder-link` line (the renderer sends
 * devlogLink(callId) once the session mints — main mints only a timestamp `recorderId`).
 *
 * DEV-ONLY gate for the dev-logs copy: !app.isPackaged && WINGMAN_DEVLOG === "1".
 * (In a packaged app app.isPackaged is true → never writes; NODE_ENV is unreliable in
 * Electron, so app.isPackaged is the correct dev signal. .env.local's WINGMAN_DEVLOG is
 * inherited via scripts/wait-and-launch.js.) The #41 userData copy is UNCHANGED — when
 * the gate is off, behavior is byte-identical to before this feature.
 *
 * MEASUREMENT ONLY — must never affect the live call:
 *  - every fs op is wrapped; a write error disables THAT stream for the call
 *  - logMeasurement() is a silent no-op when no session is open
 *  - both streams are owned by the recording lifecycle: started after
 *    sdk.startRecording() confirms, closed inside stopRecallAI()
 */

import { app } from "electron";
import * as fs from "fs";
import * as path from "path";

let stream: fs.WriteStream | null = null;       // #41 userData copy (always)
let writeErrorLogged = false;

// ── Flight Recorder dev-logs copy (dev-only) ────────────────────────────────
let devStream: fs.WriteStream | null = null;
let devWriteErrorLogged = false;
let recorderId = "";                 // the call-<timestamp> id in the main file name
let linkedCallId: string | null = null; // the server callId, once the renderer links it
const DEV_RETENTION_CALLS = 20;

/** DEV-ONLY gate. app.isPackaged is the reliable Electron dev signal (NODE_ENV is not). */
function devlogMainEnabled(): boolean {
  return !app.isPackaged && process.env.WINGMAN_DEVLOG === "1";
}

/** Keep only the newest DEV_RETENTION_CALLS *.main.jsonl. Best-effort, never throws. */
function pruneDevLogs(dir: string): void {
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith("call-") && f.endsWith(".main.jsonl"))
      .map((f) => {
        const full = path.join(dir, f);
        let mtime = 0;
        try { mtime = fs.statSync(full).mtimeMs; } catch { /* racing delete */ }
        return { full, mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);
    for (const { full } of files.slice(DEV_RETENTION_CALLS)) {
      try { fs.unlinkSync(full); } catch { /* already gone */ }
    }
  } catch { /* dir missing — nothing to prune */ }
}

/**
 * Open a fresh measurement log for a new call session.
 * Idempotent — closes any previous session's streams first.
 * Returns the #41 log file path, or null if it could not be created
 * (the call proceeds normally either way; the dev copy is independent).
 */
export function startMeasurementLog(): string | null {
  endMeasurementLog();
  writeErrorLogged = false;
  devWriteErrorLogged = false;
  linkedCallId = null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  recorderId = stamp;

  // ── Flight Recorder dev copy (independent of the #41 copy; failure here never
  //    affects the #41 log or the call) ──────────────────────────────────────
  if (devlogMainEnabled()) {
    try {
      const devDir = path.join(process.cwd(), "dev-logs");
      fs.mkdirSync(devDir, { recursive: true });
      pruneDevLogs(devDir);
      const devPath = path.join(devDir, `call-${stamp}.main.jsonl`);
      const ds = fs.createWriteStream(devPath, { flags: "a" });
      ds.on("error", (err) => {
        if (!devWriteErrorLogged) {
          console.error("[Measure] dev-log write error — disabling for this call:", err);
          devWriteErrorLogged = true;
        }
        devStream = null;
      });
      devStream = ds;
    } catch (err) {
      console.error("[Measure] could not create dev-log:", err);
      devStream = null;
    }
  }

  // ── #41 userData copy (unchanged) ──────────────────────────────────────────
  try {
    const dir = path.join(app.getPath("userData"), "partials-measurement");
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `call-${stamp}.jsonl`);
    const s = fs.createWriteStream(filePath, { flags: "a" });
    s.on("error", (err) => {
      if (!writeErrorLogged) {
        console.error("[Measure] log write error — disabling for this call:", err);
        writeErrorLogged = true;
      }
      stream = null;
    });
    stream = s;
    logMeasurement({ kind: "session_start" });
    return filePath;
  } catch (err) {
    console.error("[Measure] could not create measurement log:", err);
    stream = null;
    return null;
  }
}

/**
 * Append one entry to the current session's log(s). Arrival timestamp (ms epoch)
 * is stamped here so all entries share one clock. No-op when no session is open or
 * logging was disabled by a write error. Never throws.
 */
export function logMeasurement(entry: Record<string, unknown>): void {
  const now = Date.now();
  if (stream) {
    try {
      stream.write(JSON.stringify({ ts: now, ...entry }) + "\n");
    } catch { /* never let instrumentation break a live call */ }
  }
  // Flight Recorder dev copy — tagged for the offline merge (source + recorderId +
  // callId once linked). Independent guard so a dev-stream error never touches #41.
  if (devStream) {
    try {
      // ...entry first, canonical tags last: an entry key named source/callId/t/tMs/
      // recorderId must never clobber the fields the offline merge sorts/joins on.
      devStream.write(JSON.stringify({
        ...entry,
        t: new Date(now).toISOString(),
        tMs: now,
        recorderId,
        callId: linkedCallId,
        source: "main",
      }) + "\n");
    } catch { /* swallow — telemetry loss beats perturbing the call */ }
  }
}

/**
 * Stitch this main-process log to the server's call-<callId>.server.jsonl. The
 * renderer calls this (via IPC) once it has the session callId. Writes a link line
 * and tags all subsequent main lines with the callId. DEV-ONLY, never throws.
 */
export function linkDevlogCallId(callId: string): void {
  if (!devStream || !callId) return;
  linkedCallId = callId;
  try {
    const now = Date.now();
    devStream.write(JSON.stringify({
      t: new Date(now).toISOString(),
      tMs: now,
      recorderId,
      callId,
      source: "main",
      kind: "recorder-link",
    }) + "\n");
  } catch { /* swallow */ }
}

/** Close the current session's log(s). Idempotent — safe on every stop path. */
export function endMeasurementLog(): void {
  // Flight Recorder dev copy
  if (devStream) {
    const ds = devStream;
    devStream = null;
    linkedCallId = null;
    try { ds.write(JSON.stringify({ t: new Date().toISOString(), tMs: Date.now(), recorderId, source: "main", kind: "session_end" }) + "\n"); } catch { /* best-effort */ }
    try { ds.end(); } catch { /* already destroyed */ }
  }
  // #41 userData copy
  if (stream) {
    const s = stream;
    try {
      s.write(JSON.stringify({ ts: Date.now(), kind: "session_end" }) + "\n");
    } catch { /* best-effort final marker */ }
    stream = null;
    writeErrorLogged = false;
    try {
      s.end();
    } catch { /* stream already destroyed */ }
  }
}
