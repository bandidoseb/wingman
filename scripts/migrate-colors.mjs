#!/usr/bin/env node
/**
 * One-off-per-file colour migration: hardcoded literals → design tokens.
 *
 * WHY A SCRIPT: ~590 literals across 16 files. Hand-editing that many call sites
 * invites silent mistakes and can't be reviewed. This makes the mapping explicit
 * in ONE table you can argue with, and the substitution mechanical.
 *
 * WHY IT UNLOCKS DARK MODE: these screens are inline-styled
 * (`style={{ color: "#8e8e93" }}`), not class-based. Inline styles resolve CSS
 * custom properties fine, so `rgb(var(--ink-2))` follows the `.dark` swap without
 * restructuring a single component. Colour now, layout later.
 *
 * The mapping is SEMANTIC, not nearest-neighbour: #8e8e93 is iOS "secondary
 * label", so it becomes --ink-2 even though the warm token is a little darker.
 * That shift is the point — the Design Language palette is warm by design.
 *
 * USAGE
 *   node scripts/migrate-colors.mjs <file> [file...]      # rewrite in place
 *   node scripts/migrate-colors.mjs --dry <file>          # report only
 *
 * rgba(0,0,0,x) is deliberately NOT handled: those are hairlines AND shadows,
 * and telling them apart needs context. A near-black hairline is invisible on a
 * dark background, so each one is reviewed by hand per file.
 */

import { readFileSync, writeFileSync } from "node:fs";

/** literal (lowercased) → token name */
const MAP = {
  // ── text / ink ──────────────────────────────────────────────────────────
  "#1c1c1e": "ink-1",
  "#000000": "ink-1",
  "#000": "ink-1",
  "#3a3a3c": "ink-2",
  "#636366": "ink-2",
  "#8e8e93": "ink-2",      // iOS "secondary label"
  "#aeaeb2": "ink-3",      // iOS "tertiary label"
  "#aaa": "ink-3",

  // ── surfaces ────────────────────────────────────────────────────────────
  "#ffffff": "surface",
  "#fff": "surface",
  "#f7f5f2": "paper",      // the app background
  "#f2f2f7": "surface-sunken",
  "#f5f5f7": "surface-sunken",
  "#f9f9f9": "surface-sunken",
  "#fafafa": "surface-sunken",
  "#f7f7fb": "surface-sunken",

  // ── lines ───────────────────────────────────────────────────────────────
  "#e5e5ea": "line",
  "#c7c7cc": "line-strong",

  // ── state ───────────────────────────────────────────────────────────────
  "#34c759": "positive",
  "#30d158": "positive",
  "#ff3b30": "critical",
  "#ff453a": "critical",
  "#c0392b": "critical",
  "#007aff": "signal",
  "#4a90d9": "signal",
  "#ff9f0a": "warning",
  "#ff9500": "warning",
  "#ffc107": "warning",
  "#ffb347": "warning",
  "#ff6b35": "warning",
  "#856404": "warning",

  // ── weak / tint backgrounds ─────────────────────────────────────────────
  "#f0faf4": "positive-weak",
  "#f0faf0": "positive-weak",
  "#e5f7eb": "positive-weak",
  "#d1fae5": "positive-weak",
  "#c6f0d6": "positive-weak",
  "#fff0f0": "critical-weak",
  "#ffd5d5": "critical-weak",
  "#eef5ff": "signal-weak",
  "#f2f7ff": "signal-weak",
  "#fff8ee": "warning-weak",
  "#fff3cd": "warning-weak",

  // ── score gradient (data-viz only, §3e) ─────────────────────────────────
  "#85c440": "score-2",
  "rgb(210,35,35)": "score-0",
  "rgb(235,110,25)": "score-1",
  "rgb(240,195,30)": "score-1",
  "rgb(100,200,80)": "score-2",
  "rgb(40,170,90)": "score-3",
};

const dry = process.argv.includes("--dry");
const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));

if (!files.length) {
  console.error("usage: node scripts/migrate-colors.mjs [--dry] <file> [file...]");
  process.exit(1);
}

// Longest-first so #ffffff is never half-matched by #fff.
const keys = Object.keys(MAP).sort((a, b) => b.length - a.length);

let grandTotal = 0;

for (const file of files) {
  let src = readFileSync(file, "utf8");
  const counts = {};

  for (const lit of keys) {
    // Case-insensitive, and \b-anchored at the end so #fff doesn't eat #fff0f0.
    const re = new RegExp(
      lit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![0-9a-fA-F])",
      "gi"
    );
    const n = (src.match(re) || []).length;
    if (!n) continue;
    src = src.replace(re, `rgb(var(--${MAP[lit]}))`);
    counts[lit] = n;
    grandTotal += n;
  }

  const leftover = (src.match(/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-fA-F])/g) || []);
  const rgbaLeft = (src.match(/rgba?\(\s*[\d.]/g) || []).length;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`\n${file}`);
  console.log(`  migrated: ${total}`);
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(v).padStart(4)}  ${k}  →  --${MAP[k]}`);
  }
  if (leftover.length) {
    const uniq = [...new Set(leftover.map((s) => s.toLowerCase()))];
    console.log(`  ⚠ UNMAPPED hex (${leftover.length}): ${uniq.join(", ")}`);
  }
  if (rgbaLeft) console.log(`  ⚠ rgba()/rgb() left for manual review: ${rgbaLeft}`);

  if (!dry) writeFileSync(file, src);
}

console.log(`\n${dry ? "[dry run] would migrate" : "migrated"} ${grandTotal} literals.`);
