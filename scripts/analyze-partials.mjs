#!/usr/bin/env node
/**
 * analyze-partials.mjs — #41 stale-objection-tail measurement analyzer
 *
 * Reads a partials-measurement JSONL log (written by electron/measurement-log.ts
 * during a real call) and answers the #41 questions:
 *
 *   1. How far behind live speech is each stream? (finals vs partials)
 *   2. How much earlier does the partial stream deliver the same words
 *      that finals deliver later? ("lead time")
 *   3. At each hotkey press: what words were MISSING from the finals-only
 *      buffer, and were they already available in the partial stream?
 *
 * Usage:
 *   node scripts/analyze-partials.mjs <log-file.jsonl>
 *   node scripts/analyze-partials.mjs <directory>     # picks the newest .jsonl
 *
 * The log file path is printed by the Electron app at call start:
 *   [Measure] #41 partials log → /Users/.../partials-measurement/call-....jsonl
 *
 * Pure analysis functions are exported for unit tests
 * (tests/wingman/partials-analysis.test.ts).
 */

import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";

// ─── Tunables ─────────────────────────────────────────────────────────────────

// Finals arriving this long after a press are treated as the press's
// "missed tail" — words the card generator never saw. Covers the observed
// 1–3s Deepgram finalization lag with headroom.
export const POST_PRESS_WINDOW_MS = 4000;

// A partial older than this at press time is stale — it describes an earlier
// utterance, not the objection being pressed on, so it can't claim recovery.
export const PARTIAL_FRESH_MS = 10000;

// When matching a final back to the earliest partial that already contained
// its words, only look this far back before the final's arrival.
export const MATCH_LOOKBACK_MS = 30000;

// ─── Parsing + text helpers ───────────────────────────────────────────────────

/** Parse JSONL text into entry objects, skipping blank/corrupt lines. */
export function parseJsonl(text) {
  const entries = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      // torn write at process kill — skip
    }
  }
  return entries;
}

/** Normalize text to comparable word tokens: lowercase, punctuation stripped. */
export function normTokens(text) {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Median / p90 / max over a numeric array. */
export function computeStats(values) {
  if (values.length === 0) return { n: 0, median: null, p90: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { n: sorted.length, median: at(0.5), p90: at(0.9), max: sorted[sorted.length - 1] };
}

/**
 * Mirror the live pipeline's dedup (recall.ts lastChunkPerSpeaker): a final is
 * kept only when its text differs from the previous final emitted for that
 * speaker. Returns { finals, duplicatesDropped }.
 */
export function dedupFinals(entries) {
  const lastPerSpeaker = new Map();
  const finals = [];
  let duplicatesDropped = 0;
  for (const e of entries) {
    if (e.kind !== "final") continue;
    if (lastPerSpeaker.get(e.speaker) === e.text) {
      duplicatesDropped++;
      continue;
    }
    lastPerSpeaker.set(e.speaker, e.text);
    finals.push(e);
  }
  return { finals, duplicatesDropped };
}

// ─── Analysis 1: arrival lag vs live speech ───────────────────────────────────

/**
 * For every entry that carries an absolute last-word-end timestamp, arrival
 * lag = arrival wall time − moment the last word was spoken. Aggregated per
 * stream. This is the provider-comparable "how live is each stream" number.
 */
export function arrivalLags(entries) {
  const lags = { final: [], partial: [] };
  for (const e of entries) {
    if (e.kind !== "final" && e.kind !== "partial") continue;
    if (!e.last_word_end_abs) continue;
    const spokenAt = Date.parse(e.last_word_end_abs);
    if (Number.isNaN(spokenAt)) continue;
    lags[e.kind].push(e.ts - spokenAt);
  }
  return {
    final: computeStats(lags.final),
    partial: computeStats(lags.partial),
    hasAbsoluteTimestamps: lags.final.length > 0 || lags.partial.length > 0,
  };
}

// ─── Analysis 2: partial lead time over finals ────────────────────────────────

/**
 * For each deduped final, find the EARLIEST partial from the same speaker
 * (within MATCH_LOOKBACK_MS before the final) whose text already contained
 * the final's last 3 words. Lead = final.ts − partial.ts: how much sooner
 * the partial stream had the utterance's tail.
 */
export function finalLeadTimes(entries) {
  const { finals } = dedupFinals(entries);
  const partials = entries.filter((e) => e.kind === "partial");
  const leads = [];
  let unmatched = 0;
  for (const f of finals) {
    const tail = normTokens(f.text).slice(-3).join(" ");
    if (!tail) continue;
    const match = partials.find(
      (p) =>
        p.speaker === f.speaker &&
        p.ts <= f.ts &&
        f.ts - p.ts <= MATCH_LOOKBACK_MS &&
        normTokens(p.text).join(" ").includes(tail)
    );
    if (match) leads.push(f.ts - match.ts);
    else unmatched++;
  }
  return { stats: computeStats(leads), matched: leads.length, unmatched };
}

// ─── Analysis 3: what each press actually saw ─────────────────────────────────

/**
 * For each press: per speaker, the finals-buffer tail at press time, the
 * finals that arrived in the POST_PRESS_WINDOW_MS after it (= the missed
 * tail), the freshest partial at press time, and how many of the missed
 * words that partial already contained.
 */
export function analyzePresses(entries) {
  const { finals } = dedupFinals(entries);
  const partials = entries.filter((e) => e.kind === "partial");
  const presses = entries.filter((e) => e.kind === "press");
  const reports = [];

  for (const press of presses) {
    const lastFinalBefore = finals.filter((f) => f.ts <= press.ts).at(-1) ?? null;
    const missedBySpeaker = new Map();
    for (const f of finals) {
      if (f.ts > press.ts && f.ts <= press.ts + POST_PRESS_WINDOW_MS) {
        missedBySpeaker.set(
          f.speaker,
          (missedBySpeaker.get(f.speaker) ? missedBySpeaker.get(f.speaker) + " " : "") + f.text
        );
      }
    }

    const speakers = [];
    for (const [speaker, missedText] of missedBySpeaker) {
      const bufferTail = finals
        .filter((f) => f.speaker === speaker && f.ts <= press.ts)
        .map((f) => f.text)
        .join(" ")
        .split(/\s+/)
        .slice(-12)
        .join(" ");

      const freshPartial = partials
        .filter(
          (p) => p.speaker === speaker && p.ts <= press.ts && press.ts - p.ts <= PARTIAL_FRESH_MS
        )
        .at(-1) ?? null;

      const missedTokens = normTokens(missedText);
      const partialTokenSet = new Set(freshPartial ? normTokens(freshPartial.text) : []);
      const recoveredTokens = missedTokens.filter((t) => partialTokenSet.has(t));

      speakers.push({
        speaker,
        bufferTailAtPress: bufferTail,
        missedText,
        missedTokenCount: missedTokens.length,
        freshPartialText: freshPartial?.text ?? null,
        freshPartialAgeMs: freshPartial ? press.ts - freshPartial.ts : null,
        recoveredTokenCount: recoveredTokens.length,
        recoveryRatio:
          missedTokens.length > 0 ? recoveredTokens.length / missedTokens.length : null,
      });
    }

    reports.push({
      ts: press.ts,
      path: press.path,
      slot: press.slot ?? null,
      msSinceLastFinal: lastFinalBefore ? press.ts - lastFinalBefore.ts : null,
      hadMissedTail: speakers.length > 0,
      speakers,
    });
  }
  return reports;
}

// ─── Assembly + formatting ────────────────────────────────────────────────────

export function buildReport(entries) {
  const { finals, duplicatesDropped } = dedupFinals(entries);
  const partialCount = entries.filter((e) => e.kind === "partial").length;
  const pressReports = analyzePresses(entries);

  let totalMissed = 0;
  let totalRecovered = 0;
  for (const p of pressReports) {
    for (const s of p.speakers) {
      totalMissed += s.missedTokenCount;
      totalRecovered += s.recoveredTokenCount;
    }
  }

  return {
    counts: {
      finals: finals.length,
      duplicateFinalsDropped: duplicatesDropped,
      partials: partialCount,
      presses: pressReports.length,
    },
    arrivalLags: arrivalLags(entries),
    leadTimes: finalLeadTimes(entries),
    presses: pressReports,
    verdict: {
      totalMissedWords: totalMissed,
      totalRecoveredByPartials: totalRecovered,
      recoveryRate: totalMissed > 0 ? totalRecovered / totalMissed : null,
    },
  };
}

function fmtMs(v) {
  return v === null || v === undefined ? "n/a" : `${Math.round(v)}ms`;
}

function fmtStats(s) {
  if (s.n === 0) return "no data";
  return `median ${fmtMs(s.median)} · p90 ${fmtMs(s.p90)} · max ${fmtMs(s.max)} (n=${s.n})`;
}

export function formatReport(report) {
  const lines = [];
  const c = report.counts;
  lines.push("═══ #41 Partials Measurement Report ═══");
  lines.push("");
  lines.push(
    `Events: ${c.finals} finals (+${c.duplicateFinalsDropped} dupes dropped) · ` +
      `${c.partials} partials · ${c.presses} presses`
  );
  lines.push("");
  lines.push("── 1. Arrival lag behind live speech (lower = more live) ──");
  if (report.arrivalLags.hasAbsoluteTimestamps) {
    lines.push(`  finals:   ${fmtStats(report.arrivalLags.final)}`);
    lines.push(`  partials: ${fmtStats(report.arrivalLags.partial)}`);
  } else {
    lines.push("  (provider sent no absolute word timestamps — skipped)");
  }
  lines.push("");
  lines.push("── 2. Partial lead time (how much sooner partials had the words) ──");
  lines.push(`  ${fmtStats(report.leadTimes.stats)} · unmatched finals: ${report.leadTimes.unmatched}`);
  lines.push("");
  lines.push(`── 3. Press-by-press (missed tail = finals landing ≤${POST_PRESS_WINDOW_MS / 1000}s after press) ──`);
  if (report.presses.length === 0) lines.push("  (no presses logged)");
  for (const [i, p] of report.presses.entries()) {
    lines.push("");
    lines.push(
      `  Press #${i + 1} — ${new Date(p.ts).toLocaleTimeString()} · path=${p.path}` +
        (p.slot ? ` · slot=${p.slot}` : "") +
        ` · last final ${fmtMs(p.msSinceLastFinal)} before press`
    );
    if (!p.hadMissedTail) {
      lines.push("    ✅ no missed tail — finals buffer was complete at press time");
      continue;
    }
    for (const s of p.speakers) {
      lines.push(`    Speaker: ${s.speaker}`);
      lines.push(`      buffer tail at press: "…${s.bufferTailAtPress}"`);
      lines.push(`      ❌ MISSED (${s.missedTokenCount} words): "${s.missedText}"`);
      if (s.freshPartialText) {
        const pct = s.recoveryRatio === null ? "n/a" : `${Math.round(s.recoveryRatio * 100)}%`;
        lines.push(
          `      partial at press (${fmtMs(s.freshPartialAgeMs)} old): "${s.freshPartialText}"`
        );
        lines.push(`      → partials already had ${s.recoveredTokenCount}/${s.missedTokenCount} missed words (${pct})`);
      } else {
        lines.push("      → no fresh partial at press time (nothing to recover from)");
      }
    }
  }
  lines.push("");
  lines.push("── Verdict ──");
  const v = report.verdict;
  if (v.totalMissedWords === 0) {
    lines.push("  No words were missed at any press — the finals buffer was always current.");
  } else {
    lines.push(
      `  Across all presses the finals-only pipeline missed ${v.totalMissedWords} words; ` +
        `the partial stream already had ${v.totalRecoveredByPartials} of them ` +
        `(${Math.round((v.recoveryRate ?? 0) * 100)}% recoverable by merging partials at press time).`
    );
  }
  return lines.join("\n");
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

function resolveLogFile(arg) {
  const stat = fs.statSync(arg);
  if (stat.isFile()) return arg;
  const newest = fs
    .readdirSync(arg)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => path.join(arg, f))
    .map((p) => ({ p, mtime: fs.statSync(p).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0];
  if (!newest) throw new Error(`No .jsonl files found in ${arg}`);
  return newest.p;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: node scripts/analyze-partials.mjs <log-file.jsonl | directory>");
    console.error(
      "The log path is printed at call start: [Measure] #41 partials log → …/partials-measurement/call-….jsonl"
    );
    process.exit(1);
  }
  const file = resolveLogFile(arg);
  console.log(`Analyzing: ${file}\n`);
  const entries = parseJsonl(fs.readFileSync(file, "utf8"));
  console.log(formatReport(buildReport(entries)));
}
