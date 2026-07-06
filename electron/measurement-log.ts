/**
 * measurement-log.ts — #41 partials measurement instrumentation
 *
 * Session-scoped JSONL logger for the stale-objection-tail investigation.
 * While a call is recording, every transcript event (partial + final) and
 * every hotkey press is appended as one JSON line to a file on disk:
 *
 *   <userData>/partials-measurement/call-<timestamp>.jsonl
 *
 * The log is analyzed after the call by scripts/analyze-partials.mjs to
 * answer: "how many words does the finals-only pipeline miss at press time,
 * and were those words already available in the partial stream?"
 *
 * MEASUREMENT ONLY — this module must never affect the live call:
 *  - every fs operation is wrapped; failures disable logging and log once
 *  - logMeasurement() is a silent no-op when no session is open
 *  - the stream is owned by the recording lifecycle: started after
 *    sdk.startRecording() confirms, closed inside stopRecallAI()
 */

import { app } from "electron";
import * as fs from "fs";
import * as path from "path";

let stream: fs.WriteStream | null = null;
let writeErrorLogged = false;

/**
 * Open a fresh measurement log for a new call session.
 * Idempotent — closes any previous session's stream first.
 * Returns the log file path, or null if the log could not be created
 * (the call proceeds normally either way).
 */
export function startMeasurementLog(): string | null {
  endMeasurementLog();
  // Reset here, not just in endMeasurementLog — a write-error-disabled session
  // has a null stream, so end() early-returns and would leave this stuck true,
  // silencing the diagnostic for every later call's first write error.
  writeErrorLogged = false;
  try {
    const dir = path.join(app.getPath("userData"), "partials-measurement");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = path.join(dir, `call-${stamp}.jsonl`);
    const s = fs.createWriteStream(filePath, { flags: "a" });
    // On any write error: disable logging for the rest of the call rather
    // than risk repeated throws inside the transcript hot path.
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
 * Append one entry to the current session's log. Arrival timestamp (ms epoch)
 * is stamped here so all entries share one clock. No-op when no session is
 * open or logging was disabled by a write error. Never throws.
 */
export function logMeasurement(entry: Record<string, unknown>): void {
  if (!stream) return;
  try {
    stream.write(JSON.stringify({ ts: Date.now(), ...entry }) + "\n");
  } catch {
    // Never let instrumentation break a live call.
  }
}

/** Close the current session's log. Idempotent — safe on every stop path. */
export function endMeasurementLog(): void {
  if (!stream) return;
  const s = stream;
  try {
    s.write(JSON.stringify({ ts: Date.now(), kind: "session_end" }) + "\n");
  } catch {
    // best-effort final marker
  }
  // Null the module ref BEFORE end() — a late async 'error' event on the
  // closing stream must not clobber a newer session's stream.
  stream = null;
  writeErrorLogged = false;
  try {
    s.end();
  } catch {
    // stream already destroyed — nothing to clean up
  }
}
