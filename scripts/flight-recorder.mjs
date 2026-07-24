/**
 * flight-recorder.mjs — CLI wrapper over the Flight Recorder core (Phase 4).
 *
 * All merge/analysis logic lives in src/lib/wingman/flight-recorder-core.mjs, shared
 * with the owner dashboard's Flight Recorder tab so the two never disagree. Pure
 * offline reader — never touches the live pipeline.
 *
 *   node scripts/flight-recorder.mjs                 # newest call
 *   node scripts/flight-recorder.mjs <callId>        # a specific call
 *   node scripts/flight-recorder.mjs --list          # list captured calls
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listCalls, buildReport } from "../src/lib/wingman/flight-recorder-core.mjs";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "../dev-logs");
const arg = process.argv[2];

if (arg === "--list") {
  const calls = listCalls(DIR);
  console.log(calls.length ? "Captured calls (newest first):\n" + calls.map((c) => "  " + c).join("\n") : "No captured calls in dev-logs/.");
  process.exit(0);
}

const calls = listCalls(DIR);
if (!calls.length) { console.log("No captured calls in dev-logs/. Run a call with WINGMAN_DEVLOG=1 first."); process.exit(0); }

const callId = arg || calls[0]; // listCalls is newest-first
const report = buildReport(DIR, callId);
if (!report) { console.log(`No usable log for call ${callId}.`); process.exit(1); }

const outPath = join(DIR, `call-${callId}.report.md`);
writeFileSync(outPath, report.markdown);
console.log(report.markdown.split("\n").slice(0, 8).join("\n"));
console.log(`\nFull report → ${outPath}`);
