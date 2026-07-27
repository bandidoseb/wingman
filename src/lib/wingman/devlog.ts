/**
 * devlog.ts — Flight Recorder server-side sink (DEV-ONLY).
 *
 * Spec: tasks/plan-flight-recorder.md. Captures raw facts from the API routes +
 * (via /api/wingman/devlog) the renderer into per-call JSONL files that Claude
 * reads and the /devlog page renders. Every diff/adoption/tic-scan is derived
 * OFFLINE from these files — this module only appends raw lines.
 *
 * HARD GATE (defense-in-depth): writes NOTHING unless
 *   NODE_ENV !== "production"  AND  WINGMAN_DEVLOG === "1".
 * On Railway (NODE_ENV="production", flag unset) every call here is a no-op, so
 * the full Sales DNA / prompts this captures can never land in prod.
 *
 * SAFETY (mirrors electron/measurement-log.ts): one buffered fs.WriteStream per
 * callId (ordered, non-blocking .write — never concurrent appendFile, which would
 * interleave and corrupt JSONL). Every fs op is wrapped; a write error disables
 * that call's stream rather than throw into a live-call hot path. append() must
 * NEVER throw and must NEVER be awaited on a path the model/stream depends on.
 */

import * as fs from "fs";
import * as path from "path";

// Keep the newest N calls' server logs; prune older at record-start. Rolling.
const RETENTION_CALLS = 20;
// Truncate any single string field beyond this — full transcripts/prompts qualify.
// Prevents one pathological line from ballooning the file.
const MAX_FIELD_CHARS = 32_000;

export type DevlogSource = "server" | "renderer" | "main";

/** The one gate. Both conditions required. Read live (not cached) so flipping the
 *  env between dev runs takes effect without a rebuild of this module's state. */
export function devlogEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.WINGMAN_DEVLOG === "1";
}

const DIR = path.join(process.cwd(), "dev-logs");

// One WriteStream per callId. Bounded implicitly by RETENTION + call lifecycle;
// closeDevlog() removes entries, and a fresh call reuses the same key.
const streams = new Map<string, fs.WriteStream>();
const writeErrorLogged = new Set<string>();

/** Keep only the newest RETENTION_CALLS server logs. Best-effort, never throws.
 *  (Phase 3 extends this to *.main.jsonl.) */
function pruneOldLogs(): void {
  try {
    const files = fs
      .readdirSync(DIR)
      .filter((f) => f.startsWith("call-") && f.endsWith(".server.jsonl"))
      .map((f) => {
        const full = path.join(DIR, f);
        let mtime = 0;
        try { mtime = fs.statSync(full).mtimeMs; } catch { /* racing delete */ }
        return { full, mtime };
      })
      .sort((a, b) => b.mtime - a.mtime); // newest first
    for (const { full } of files.slice(RETENTION_CALLS)) {
      try { fs.unlinkSync(full); } catch { /* already gone */ }
    }
  } catch {
    // dir missing / unreadable — nothing to prune
  }
}

/** Lazily open (and register) the stream for a callId. Returns null if disabled
 *  or the file could not be opened. */
function streamFor(callId: string): fs.WriteStream | null {
  if (!devlogEnabled()) return null;
  const existing = streams.get(callId);
  if (existing) return existing;
  try {
    fs.mkdirSync(DIR, { recursive: true });
    pruneOldLogs(); // at record-start for this call
    const filePath = path.join(DIR, `call-${callId}.server.jsonl`);
    const s = fs.createWriteStream(filePath, { flags: "a" });
    s.on("error", (err) => {
      if (!writeErrorLogged.has(callId)) {
        console.error(`[devlog] write error for call=${callId} — disabling:`, err);
        writeErrorLogged.add(callId);
      }
      streams.delete(callId);
    });
    streams.set(callId, s);
    return s;
  } catch (err) {
    console.error(`[devlog] could not open log for call=${callId}:`, err);
    return null;
  }
}

/** Cap oversized string fields so one line can't balloon the file. Shallow —
 *  payloads are flat records of primitives/strings by construction. */
function capFields(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (typeof v === "string" && v.length > MAX_FIELD_CHARS) {
      out[k] = v.slice(0, MAX_FIELD_CHARS) + `…[+${v.length - MAX_FIELD_CHARS} chars]`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Append one raw record to a call's server log. No-op when disabled. Never throws.
 * Fire-and-forget — do NOT await on any path a live card/stream depends on.
 */
export function append(
  callId: string,
  source: DevlogSource,
  kind: string,
  payload: Record<string, unknown> = {},
): void {
  // callId flows into the filename and (via the route) is client-controlled — reject
  // anything but the UUID/slug charset so it can't traverse out of dev-logs/.
  if (!callId || !/^[A-Za-z0-9_-]+$/.test(callId)) return;
  const s = streamFor(callId);
  if (!s) return;
  try {
    // capFields first, canonical fields last: a client payload key ("source", "kind", …)
    // must never clobber the canonical tags the offline merge sorts on.
    const line = JSON.stringify({
      ...capFields(payload),
      t: new Date().toISOString(),
      tMs: Date.now(),
      callId,
      source,
      kind,
    });
    s.write(line + "\n");
  } catch {
    // Never let instrumentation break a live call.
  }
}

/** Close a call's log (on the footer/session-end event). Idempotent, never throws. */
export function closeDevlog(callId: string): void {
  const s = streams.get(callId);
  if (!s) return;
  streams.delete(callId);
  writeErrorLogged.delete(callId);
  try { s.end(); } catch { /* already destroyed */ }
}
