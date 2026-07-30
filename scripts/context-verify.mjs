#!/usr/bin/env node
/**
 * context-verify — proves the context cleanup lost nothing.
 *
 * THE GUARANTEE THIS IMPLEMENTS:
 * Sebastian's condition for the 2026-07-30 cleanup was "I don't want to lose
 * anything." Care is not a guarantee; a check is. This reads every line of text
 * from the frozen pre-cleanup snapshot, then asserts each one still exists
 * SOMEWHERE in the project today. Moved, renamed, and reorganised files all pass.
 * Only genuinely-vanished text fails.
 *
 * HOW A LINE IS ALLOWED TO DISAPPEAR:
 * Exactly one way — by being listed in `context/removed-on-purpose.md` with a
 * reason. That file is the complete, human-readable record of every deletion.
 * If a line is gone and is NOT in that file, this exits 1 and names it.
 *
 * WHY EXACT-LINE MATCHING (not fuzzy):
 * Archiving moves text verbatim. Exact matching means a reworded line is treated
 * as a deletion and must be justified — strict in the safe direction. The cost is
 * that intentional rewrites must be declared, which is the point.
 *
 * USAGE
 *   node scripts/context-verify.mjs                 # verify against the default tag
 *   node scripts/context-verify.mjs --tag <name>    # verify against another snapshot
 *   node scripts/context-verify.mjs --list          # print every missing line, undeduped
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MEMORY_DIR =
  "/Users/sebastianperez/.claude/projects/-Users-sebastianperez-Desktop-Wingman-CC/memory";

const argv = process.argv.slice(2);
const TAG = argv.includes("--tag") ? argv[argv.indexOf("--tag") + 1] : "context-backup-2026-07-30";
const LIST_ALL = argv.includes("--list");

/** Context surfaces. Code is out of scope — this checks prose, not source. */
const IS_CONTEXT = (p) =>
  (p.endsWith(".md") || p.endsWith(".mdx")) &&
  !p.startsWith("node_modules/") &&
  !p.includes("/node_modules/");

/**
 * Structural noise. These carry no information, appear thousands of times, and
 * would drown a real finding. Everything else is checked.
 */
function isNoise(line) {
  const t = line.trim();
  if (t.length < 8) return true;
  if (/^[-=*_#|>\s:]+$/.test(t)) return true;      // rules, empty table borders
  if (/^\|[\s|:-]+\|$/.test(t)) return true;        // table separator rows
  if (/^```/.test(t)) return true;
  return false;
}

const norm = (line) => line.trim().replace(/\s+/g, " ");

function git(...args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
}

// --------------------------------------------------------------------------
// 1. Baseline — every context line as it existed at the snapshot.

let tagFiles;
try {
  tagFiles = git("ls-tree", "-r", "--name-only", TAG).split("\n").filter(IS_CONTEXT);
} catch {
  console.error(`✗ context-verify: snapshot tag '${TAG}' not found.`);
  console.error(`  Create one before cleaning up:  git tag ${TAG}`);
  process.exit(1);
}

/** normalized line -> Set of files it came from */
const baseline = new Map();
for (const f of tagFiles) {
  let body;
  try {
    body = git("show", `${TAG}:${f}`);
  } catch {
    continue;
  }
  for (const raw of body.split("\n")) {
    if (isNoise(raw)) continue;
    const k = norm(raw);
    if (!baseline.has(k)) baseline.set(k, new Set());
    baseline.get(k).add(f);
  }
}

// --------------------------------------------------------------------------
// 2. Haystack — every line that exists in the project RIGHT NOW.
//    Includes the live memory directory, which lives outside the repo.

function walkMd(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === ".next") continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkMd(full, out);
    else if (IS_CONTEXT(entry)) out.push(full);
  }
  return out;
}

const currentFiles = [...walkMd(ROOT), ...walkMd(MEMORY_DIR)];
const present = new Set();
for (const f of currentFiles) {
  let body;
  try {
    body = readFileSync(f, "utf8");
  } catch {
    continue;
  }
  for (const raw of body.split("\n")) {
    if (isNoise(raw)) continue;
    present.add(norm(raw));
  }
}

// --------------------------------------------------------------------------
// 3. Declared removals.

const REMOVED_PATH = join(ROOT, "context", "removed-on-purpose.md");
const declared = new Set();
if (existsSync(REMOVED_PATH)) {
  for (const raw of readFileSync(REMOVED_PATH, "utf8").split("\n")) {
    const m = /^\s*REMOVED:\s*(.+)$/.exec(raw);
    if (m) declared.add(norm(m[1]));
  }
}

// --------------------------------------------------------------------------
// 4. Compare.

const missing = [];
for (const [line, files] of baseline) {
  if (present.has(line)) continue;
  if (declared.has(line)) continue;
  missing.push({ line, files: [...files] });
}

const scanned = baseline.size;
console.log(`context-verify — snapshot '${TAG}'`);
console.log(`  ${tagFiles.length} context files at snapshot · ${currentFiles.length} today`);
console.log(`  ${scanned.toLocaleString()} unique lines checked · ${declared.size} declared removals`);
console.log("");

if (!missing.length) {
  console.log(`✅ 0 lines missing. Every line of text from before the cleanup still exists.`);
  process.exit(0);
}

// Group by source file so the report reads like a map, not a wall.
const byFile = new Map();
for (const m of missing) {
  const key = m.files[0];
  if (!byFile.has(key)) byFile.set(key, []);
  byFile.get(key).push(m.line);
}

console.error(`❌ ${missing.length} line(s) exist in the snapshot but nowhere today.\n`);
console.error(`   Each one is either a genuine loss (restore it) or an intentional edit`);
console.error(`   (declare it in context/removed-on-purpose.md as:  REMOVED: <the exact line>)\n`);

for (const [file, lines] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
  console.error(`  ${file}  (${lines.length})`);
  for (const l of LIST_ALL ? lines : lines.slice(0, 6)) {
    console.error(`      ${l.length > 130 ? l.slice(0, 129) + "…" : l}`);
  }
  if (!LIST_ALL && lines.length > 6) console.error(`      … ${lines.length - 6} more (--list to see all)`);
  console.error("");
}

console.error(`  Restore everything:  git checkout ${TAG}`);
process.exit(1);
