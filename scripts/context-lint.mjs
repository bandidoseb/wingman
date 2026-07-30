#!/usr/bin/env node
/**
 * context-lint — keeps the context system from rotting back into what it was.
 *
 * WHY A LINT AND NOT A RULE IN CLAUDE.md:
 * The old system's rules were followed perfectly for 34 sessions. They were just
 * WRONG — "always append, never overwrite" was obeyed all the way to a 755-line
 * Current Sprint.md. Prose can be obeyed and still produce the bad outcome, and a
 * long CLAUDE.md gets skimmed. These checks run whether or not anyone remembers them.
 *
 * WHY THE SIZE CHECK ONLY WARNS:
 * scripts/token-lint.mjs already learned this lesson out loud: a hard gate on
 * pre-existing debt "would have been disabled within a week." Size warns and
 * ratchets; the structural checks (which are cheap to satisfy) block.
 *
 * USAGE
 *   node scripts/context-lint.mjs            # check (structural = fail, size = warn)
 *   node scripts/context-lint.mjs --strict   # size regressions fail too
 *   node scripts/context-lint.mjs --update   # re-baseline sizes after an intentional change
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BASELINE = join(ROOT, "scripts", "context-lint-baseline.json");
const MEMORY_DIR =
  "/Users/sebastianperez/.claude/projects/-Users-sebastianperez-Desktop-Wingman-CC/memory";

const MODE = process.argv.includes("--update") ? "update"
  : process.argv.includes("--strict") ? "strict" : "check";

const BUILD_LOG = join(ROOT, "Wingman Brain", "01 - Build Log");
const NOW = join(BUILD_LOG, "NOW.md");
const ISSUES = join(BUILD_LOG, "Known Issues.md");

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);
const errors = [];
const warns = [];

// ---------------------------------------------------------------------------
// 1. NOW.md may only carry the five agreed headings.
//    A sixth is how "just one more section" became a 755-line file.

const ALLOWED_NOW = ["Next action", "Blocked on Sebastian", "In flight", "Carry-forwards", "Backlog"];

const now = read(NOW);
if (now === null) {
  errors.push(`NOW.md is missing (${NOW}). It is the only hand-written state file.`);
} else {
  const headings = [...now.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1].trim());
  const extra = headings.filter((h) => !ALLOWED_NOW.includes(h));
  if (extra.length) {
    errors.push(
      `NOW.md has ${extra.length} heading(s) outside the allowed five: ${extra.map((e) => `"${e}"`).join(", ")}\n` +
      `      Allowed: ${ALLOWED_NOW.join(" · ")}\n` +
      `      Finished work belongs in today's YYYY-MM-DD.md, then Sprint Archive.md.`
    );
  }
}

// ---------------------------------------------------------------------------
// 2. Known Issues.md lists OPEN issues. Resolved rows move to the archive.
//    It reached 59 rows with 30 already fixed — a 50% over-report.

const issues = read(ISSUES);
if (issues !== null) {
  const openSection = issues.split(/^##\s+Issue Entry Format/m)[0];
  const rows = openSection.split("\n").filter((l) => /^\|\s*\d+[a-z]?\s*\|/.test(l));
  // ◐ / "needs testing" / "partially" rows stay on purpose: something is still unverified.
  const stillOpen = /◐|needs testing|partially|in progress|pending/i;
  // Read the STATUS column only. Scanning the whole row matched the words
  // "resolved"/"fixed" inside root-cause Notes and flagged genuinely-open issues.
  const statusOf = (row) => (row.split("|")[4] ?? "").trim();
  const done = rows.filter((r) => {
    const s = statusOf(r);
    return /✅|\bRESOLVED\b|\bFIXED\b|\bClosed\b/i.test(s) && !stillOpen.test(s);
  });
  if (done.length) {
    const nums = done.map((r) => r.match(/^\|\s*(\d+[a-z]?)/)?.[1]).filter(Boolean);
    errors.push(
      `Known Issues.md still lists ${done.length} fully-resolved row(s): #${nums.join(", #")}\n` +
      `      Move them VERBATIM (full Notes column) to "Known Issues Archive.md".\n` +
      `      Rows with ◐ / "Needs testing" / "Partially resolved" correctly stay — they have work left.`
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Status is never hand-typed. This is the check that would have caught the
//    "17 commits UNPUSHED" claim about a branch that had already merged.

const BANNED = [
  { re: /\b(not|never)\s+pushed\b/i,        why: "branch state" },
  { re: /\b(not|never)\s+merged\b/i,        why: "PR state" },
  { re: /\bunpushed\b/i,                    why: "branch state" },
  { re: /\bcommits?\s+ahead\b/i,            why: "commit counts" },
  { re: /\bnothing\s+(new\s+)?deployed\b/i, why: "deploy state" },
  { re: /\bheld\s+local\b/i,                why: "branch state" },
];

for (const [label, path] of [["NOW.md", NOW], ["MEMORY.md", join(MEMORY_DIR, "MEMORY.md")]]) {
  const body = read(path);
  if (!body) continue;
  body.split("\n").forEach((line, i) => {
    // Escape hatch, same convention as token-lint: prose that EXPLAINS the rule or
    // quotes the historical mistake has to be able to say the banned words.
    if (line.includes("context-lint-ok")) return;
    for (const { re, why } of BANNED) {
      if (re.test(line)) {
        errors.push(
          `${label}:${i + 1} hand-typed ${why} — "${line.trim().slice(0, 90)}"\n` +
          `      Delete it. The SessionStart hook reports branch/PR/release state live.`
        );
        break;
      }
    }
  });
}

// ---------------------------------------------------------------------------
// 4. Memory wikilink integrity — a [[link]] that resolves to nothing is a
//    pointer into a void, and the graph is what makes recall work.

if (existsSync(MEMORY_DIR)) {
  const memFiles = readdirSync(MEMORY_DIR).filter((f) => f.endsWith(".md") && f !== "MEMORY.md");
  const slugs = new Set();
  for (const f of memFiles) {
    const m = /^name:\s*(.+)$/m.exec(readFileSync(join(MEMORY_DIR, f), "utf8"));
    if (m) slugs.add(m[1].trim());
    slugs.add(f.slice(0, -3));
    slugs.add(f.slice(0, -3).replace(/_/g, "-"));
  }
  // Vault notes are legitimate wikilink targets too (Obsidian resolves vault-wide).
  const vault = new Set();
  const walkVault = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walkVault(join(d, e.name));
      else if (e.name.endsWith(".md")) vault.add(e.name.slice(0, -3));
    }
  };
  try { walkVault(join(ROOT, "Wingman Brain")); } catch { /* vault optional */ }

  const broken = [];
  for (const f of [...memFiles, "MEMORY.md"]) {
    const body = read(join(MEMORY_DIR, f));
    if (!body) continue;
    for (const m of body.matchAll(/\[\[([^\]|#]+)/g)) {
      const t = m[1].trim();
      if (!t || slugs.has(t) || vault.has(t) || slugs.has(t.replace(/-/g, "_"))) continue;
      broken.push(`${f} → [[${t}]]`);
    }
  }
  if (broken.length) {
    warns.push(`${broken.length} unresolved memory wikilink(s):\n      ` + broken.slice(0, 8).join("\n      "));
  }
}

// ---------------------------------------------------------------------------
// 5. Size ratchet — session-start files may not grow. Warns, never blocks
//    (unless --strict), because a gate people disable protects nothing.

const TRACKED = {
  "CLAUDE.md": join(ROOT, "CLAUDE.md"),
  "context/STATE.md": join(ROOT, "context", "STATE.md"),
  "Wingman Brain/01 - Build Log/NOW.md": NOW,
  "Wingman Brain/01 - Build Log/Known Issues.md": ISSUES,
  "MEMORY.md": join(MEMORY_DIR, "MEMORY.md"),
  "tasks/lessons.md": join(ROOT, "tasks", "lessons.md"),
  "tasks/launch-plan.md": join(ROOT, "tasks", "launch-plan.md"),
};

const sizes = {};
for (const [k, p] of Object.entries(TRACKED)) {
  const b = read(p);
  if (b !== null) sizes[k] = b.length;
}
const total = Object.values(sizes).reduce((a, b) => a + b, 0);

if (MODE === "update") {
  writeFileSync(BASELINE, JSON.stringify({ _totalChars: total, ...sizes }, null, 2) + "\n");
  console.log(`context-lint: baseline updated — ${Object.keys(sizes).length} files, ${(total / 1024).toFixed(1)}KB (~${Math.round(total / 4).toLocaleString()} tokens at session start).`);
  process.exit(0);
}

if (existsSync(BASELINE)) {
  const { _totalChars, ...base } = JSON.parse(readFileSync(BASELINE, "utf8"));
  const grown = Object.entries(sizes)
    .filter(([k, v]) => base[k] !== undefined && v > base[k] * 1.15)
    .map(([k, v]) => `${k}  ${base[k]} → ${v} chars (+${Math.round(((v - base[k]) / base[k]) * 100)}%)`);
  if (grown.length) {
    const msg =
      `session-start file(s) grew more than 15%:\n      ` + grown.join("\n      ") +
      `\n      Move the finished parts to their archive, then re-baseline:` +
      `\n          npm run context:lint -- --update`;
    (MODE === "strict" ? errors : warns).push(msg);
  }
}

// ---------------------------------------------------------------------------

for (const w of warns) console.error(`⚠️  context-lint: ${w}\n`);

if (errors.length) {
  console.error(`✗ context-lint: ${errors.length} problem(s) — the context system is drifting.\n`);
  for (const e of errors) console.error(`  • ${e}\n`);
  console.error(`  These are structural, not stylistic. Each has a named destination for the content.`);
  console.error(`  Full rules: "Wingman Brain/CLAUDE.md" → Rules.\n`);
  process.exit(1);
}

console.log(
  `✓ context-lint: clean. Session-start context ≈ ${Math.round(total / 4).toLocaleString()} tokens` +
  `${warns.length ? ` (${warns.length} warning${warns.length > 1 ? "s" : ""})` : ""}.`
);
