#!/usr/bin/env node
/**
 * token-lint — enforces Design Language §5b: "ONE token file, everything reads
 * from it. NO hardcoded hex / one-off spacing / stray fonts anywhere."
 *
 * WHY A RATCHET, NOT A HARD GATE:
 * When this landed (2026-07-28) the dashboard carried 577 hardcoded color
 * literals across 41 unique values. A hard gate would have turned CI red on
 * every PR from day one, which means it would have been disabled within a week.
 * Instead we baseline the existing debt per file and fail on any INCREASE. Each
 * screen rebuilt during the dashboard rebuild ratchets its number down to 0,
 * and the baseline is regenerated. Debt can only ever shrink.
 *
 * USAGE
 *   node scripts/token-lint.mjs             # check against baseline (CI)
 *   node scripts/token-lint.mjs --update    # regenerate the baseline after migrating a screen
 *   node scripts/token-lint.mjs --report    # list every violation, always exit 0
 *
 * ESCAPE HATCH
 *   Add `token-lint-disable-next-line` in a comment above a genuinely unavoidable
 *   literal (e.g. a third-party embed that demands a hex string).
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BASELINE_PATH = join(ROOT, "scripts", "token-lint-baseline.json");

/** Directories whose color values must come from tokens. */
const SCAN_ROOTS = [
  join("src", "app", "(dashboard)"),
  join("src", "components", "dashboard"),
  join("src", "components", "ui"),
];

const EXTENSIONS = [".tsx", ".ts", ".css"];

/**
 * Files exempt from the rule.
 * globals.css IS the token source — it is the one place literals belong.
 */
const EXEMPT = new Set([join("src", "app", "globals.css")]);

/**
 * Color literals we reject.
 * - hex:  #fff, #ffff, #ffffff, #ffffffff
 * - rgb/rgba/hsl/hsla with NUMERIC args. `rgb(var(--ink-1))` is the correct
 *   form and must not be flagged, hence the digit lookahead.
 */
const PATTERNS = [
  { name: "hex", re: /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g },
  { name: "rgb/hsl", re: /\b(?:rgba?|hsla?)\(\s*[\d.]/g },
];

const IGNORE_DIRECTIVE = "token-lint-disable-next-line";

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

function scanFile(absPath) {
  const rel = relative(ROOT, absPath).split(sep).join("/");
  const lines = readFileSync(absPath, "utf8").split("\n");
  const hits = [];

  lines.forEach((line, i) => {
    // Respect the escape hatch on the preceding line.
    if (i > 0 && lines[i - 1].includes(IGNORE_DIRECTIVE)) return;

    for (const { name, re } of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        hits.push({ file: rel, line: i + 1, kind: name, text: m[0], src: line.trim() });
      }
    }
  });

  return hits;
}

function collect() {
  const files = SCAN_ROOTS.flatMap((r) => walk(join(ROOT, r)));
  const violations = [];
  for (const f of files) {
    const rel = relative(ROOT, f);
    if (EXEMPT.has(rel)) continue;
    violations.push(...scanFile(f));
  }
  return violations;
}

function tally(violations) {
  const counts = {};
  for (const v of violations) counts[v.file] = (counts[v.file] ?? 0) + 1;
  return counts;
}

// ---------------------------------------------------------------------------

const mode = process.argv.includes("--update")
  ? "update"
  : process.argv.includes("--report")
    ? "report"
    : "check";

const violations = collect();
const counts = tally(violations);
const total = violations.length;

if (mode === "report") {
  for (const v of violations) {
    console.log(`${v.file}:${v.line}  ${v.kind}  ${v.text}`);
  }
  console.log(`\n${total} color literals across ${Object.keys(counts).length} files.`);
  process.exit(0);
}

if (mode === "update") {
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify({ _total: total, ...Object.fromEntries(Object.entries(counts).sort()) }, null, 2) + "\n"
  );
  console.log(`token-lint: baseline updated — ${total} literals across ${Object.keys(counts).length} files.`);
  process.exit(0);
}

// --- check mode ------------------------------------------------------------

if (!existsSync(BASELINE_PATH)) {
  console.error("token-lint: no baseline found. Run: npm run token-lint -- --update");
  process.exit(1);
}

const baselineRaw = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
const { _total: _ignored, ...baseline } = baselineRaw;

const regressions = [];
const improvements = [];

for (const [file, count] of Object.entries(counts)) {
  const allowed = baseline[file] ?? 0;
  if (count > allowed) regressions.push({ file, count, allowed });
}
for (const [file, allowed] of Object.entries(baseline)) {
  const count = counts[file] ?? 0;
  if (count < allowed) improvements.push({ file, count, allowed });
}

if (regressions.length) {
  console.error("\n✗ token-lint: hardcoded color literals INCREASED.\n");
  console.error("  Design Language §5b — colors come from tokens in src/app/globals.css.");
  console.error("  Use: bg-surface, text-ink-2, border-line, bg-signal, text-critical …");
  console.error("  In raw CSS: rgb(var(--ink-1))\n");
  console.error("  NOT actually a color? An issue ref like `#123`, or a URL fragment like");
  console.error("  href=\"#faq\", can look like a hex value. Put this in a comment on the");
  console.error("  line ABOVE it and the check will skip it:\n");
  console.error("      // token-lint-disable-next-line\n");
  for (const r of regressions) {
    console.error(`  ${r.file}  ${r.allowed} → ${r.count}  (+${r.count - r.allowed})`);
    for (const v of violations.filter((v) => v.file === r.file).slice(0, 10)) {
      console.error(`      line ${v.line}: ${v.text}`);
    }
  }
  console.error("");
  process.exit(1);
}

if (improvements.length) {
  console.error("\n✗ token-lint: baseline is STALE — literals were removed but the baseline still allows them.\n");
  console.error("  This is good news; the ratchet just needs tightening. Run:\n");
  console.error("      npm run token-lint -- --update\n");
  for (const i of improvements) {
    console.error(`  ${i.file}  ${i.allowed} → ${i.count}  (-${i.allowed - i.count})`);
  }
  console.error("");
  process.exit(1);
}

console.log(`✓ token-lint: no color-literal regressions (${total} baselined, ratcheting down).`);
