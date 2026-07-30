#!/usr/bin/env node
/**
 * context-gen — generates the parts of the context system that a machine can
 * know better than a human can remember.
 *
 * WHY THIS EXISTS:
 * On 2026-07-30 an audit found the brain confidently asserting things that were
 * false: CLAUDE.md said v0.1.22 (it was 0.1.29), MEMORY.md and Current Sprint
 * both said the dashboard branch was "17 commits UNPUSHED" when it had merged as
 * PR #58 and shipped. Every one of those facts is derivable from git or from the
 * files themselves. Hand-typed status is the single largest source of rot in this
 * system, so status is no longer hand-typed — it is generated here.
 *
 * WHAT IT WRITES (both are GENERATED — never hand-edit, the wrap hook blocks it):
 *   context/STATE.md                        Claude-facing. Read at session start.
 *   Wingman Brain/01 - Build Log/Build Log.md  Human-facing Obsidian index of every
 *                                           dated log. Was 78% broken (listed 9 of 41).
 *
 * WHAT IT DELIBERATELY DOES NOT DO:
 * No network. No `gh` calls. Those live in the SessionStart hook, which runs fresh
 * every session — baking a release number into a committed file just relocates the
 * staleness problem. This script only reads the repo and local git.
 *
 * USAGE
 *   node scripts/context-gen.mjs           # write both files
 *   node scripts/context-gen.mjs --check   # exit 1 if output would differ (CI / hook)
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BUILD_LOG_DIR = join(ROOT, "Wingman Brain", "01 - Build Log");
const CONTEXT_DIR = join(ROOT, "context");

const CHECK_ONLY = process.argv.includes("--check");

// ---------------------------------------------------------------------------
// helpers

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");

/** Strip markdown decoration down to readable prose. */
function plain(s) {
  return s
    .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // Strip heading/quote markers, but keep inline `#` — "#39" is an issue
    // number, not a heading, and dropping it made the index unsearchable.
    .replace(/^\s*#{1,6}\s+/, "")
    .replace(/^\s*>\s?/, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(s, n) {
  const t = plain(s);
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
}

function git(...args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// 1. Build-log index

/**
 * Most dated logs are titled "Build Log — YYYY-MM-DD", which says nothing. When
 * the H1 is generic, dig for the first line that carries actual meaning.
 */
const GENERIC_TITLE = /^(daily\s+)?build log\s*[—-]\s*\d{4}-\d{2}-\d{2}\s*$/i;

/**
 * Sebastian hand-wrote these nine summaries in the original Build Log.md index.
 * They are better than anything auto-extraction produces from those early logs
 * (which lead with "Changes made:" and "Critical issues caught before building:").
 * Preserved verbatim — the generator never overwrites a human summary.
 */
const HAND_WRITTEN = {
  "2026-04-19": "Flight Plan feature (guided UI, pillar evaluation, Framework Coverage card)",
  "2026-04-18": "Mission Intel deep dive flow, prompt caching, security guard",
  "2026-04-17": "Junction table architecture, calibration tool, KB scores 0.38 → 0.88",
  "2026-04-15": "Dual KB architecture, cleanup.js, backfill-coaching.js",
  "2026-04-13": "KB Re-ingestion Spec v2, SQL migration 006, ingest.js rewrite",
  "2026-04-10": "Signal card visual redesign, two-tier format, stage label fix",
  "2026-04-09": "/wrap skill, Obsidian brain added to GitHub, stop hook hardened",
  "2026-04-07": "Transcript dedup fix, poll chunk limit, disposition bug, processing skeleton",
  "2026-04-02": "Initial build session",
};

function summarizeLog(body) {
  const lines = body.split("\n");

  const h1 = lines.find((l) => /^#[^#]/.test(l));
  if (h1) {
    const t = plain(h1.replace(/^#\s*/, ""));
    // "2026-07-24 — Flight Recorder built end-to-end" → keep the half after the dash.
    const afterDate = t.replace(/^\d{4}-\d{2}-\d{2}\s*[—-]\s*/, "");
    if (!GENERIC_TITLE.test(t) && afterDate.length > 4) return clip(afterDate, 105);
  }

  // Generic H1 → first substantive bullet or bolded lead, skipping scaffolding.
  const SKIP =
    /^(what got built|what we did|session summary|what happened|sessions?\b|related:|index of|changes made|files?:|critical issues|what's next|test steps|status:)/i;
  for (const raw of lines) {
    const l = raw.trim();
    if (!l || l.startsWith("#") || l.startsWith(">") || l.startsWith("|") || l.startsWith("---")) continue;
    const bullet = l.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, "");
    if (bullet === l && !/^\*\*/.test(l)) continue; // not a bullet or bold lead
    const t = plain(bullet);
    if (t.length < 12 || SKIP.test(t)) continue;
    return clip(t, 105);
  }
  return "(no summary line found)";
}

function datedLogs() {
  return readdirSync(BUILD_LOG_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse()
    .map((f) => {
      const date = f.replace(/\.md$/, "");
      const summary = HAND_WRITTEN[date] ?? summarizeLog(read(join(BUILD_LOG_DIR, f)));
      return { date, file: f, summary };
    });
}

function renderBuildLogIndex(logs) {
  const byMonth = new Map();
  for (const l of logs) {
    const m = l.date.slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m).push(l);
  }

  const MONTHS = {
    "01": "January", "02": "February", "03": "March", "04": "April",
    "05": "May", "06": "June", "07": "July", "08": "August",
    "09": "September", "10": "October", "11": "November", "12": "December",
  };

  const out = [
    "# Build Log",
    "",
    "<!-- GENERATED by scripts/context-gen.mjs — do not hand-edit. Run: npm run context:gen -->",
    "",
    `Index of every build session — **${logs.length} logs**, newest first.`,
    "One file per session. This index is regenerated on every wrap, so it can never drift.",
    "",
    "**Related:** [[NOW]] | [[Sprint Archive]] | [[Known Issues]] | [[Decisions Log]]",
    "",
    "---",
    "",
  ];

  for (const [month, items] of byMonth) {
    out.push(`## ${MONTHS[month.slice(5, 7)]} ${month.slice(0, 4)}`, "");
    for (const l of items) out.push(`- [[${l.date}]] — ${l.summary}`);
    out.push("");
  }

  return out.join("\n");
}

// ---------------------------------------------------------------------------
// 2. Indexes of the big files that no longer load at session start

function decisionsIndex() {
  const body = read(join(BUILD_LOG_DIR, "Decisions Log.md"));
  const out = [];
  for (const line of body.split("\n")) {
    const m = /^###\s+(.*)$/.exec(line);
    if (!m) continue;
    const t = plain(m[1]);
    const superseded = /superseded|reversed|retired/i.test(t);
    out.push({ title: clip(t, 100), superseded });
  }
  return out;
}

function issuesIndex(file) {
  const body = read(join(BUILD_LOG_DIR, file));
  const rows = [];
  for (const line of body.split("\n")) {
    const m = /^\|\s*(\d+[a-z]?)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/.exec(line);
    if (!m) continue;
    const [, num, title, , status] = m;
    rows.push({
      num,
      title: clip(title, 88),
      resolved: /resolved|✅|fixed|closed/i.test(status),
    });
  }
  return rows;
}

/**
 * Modules with zero inbound imports. CLAUDE.md documented `keyword-triggers.ts`
 * as a live pipeline stage for months after nothing imported it; this makes that
 * class of lie self-correcting.
 */
function orphanModules() {
  const WATCH = [join("src", "lib", "wingman"), join("src", "components", "wingman")];
  const files = [];
  for (const dir of WATCH) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      if (/\.(ts|tsx|mjs)$/.test(f) && !/\.(test|spec)\./.test(f)) {
        files.push(join(dir, f).split(sep).join("/"));
      }
    }
  }

  // One grep pass over the whole source tree, then match names locally.
  let haystack = "";
  try {
    haystack = execFileSync(
      "grep",
      ["-rh", "--include=*.ts", "--include=*.tsx", "--include=*.mjs", "-E", "from ['\"]|require\\(|import\\(", "src", "electron", "scripts"],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
    );
  } catch {
    return [];
  }

  const orphans = [];
  for (const rel of files) {
    const base = rel.split("/").pop().replace(/\.(ts|tsx|mjs)$/, "");
    // Match an import specifier ending in this module name, not a substring of a longer one.
    const re = new RegExp(`[/'"]${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\.mjs)?['"]`);
    if (!re.test(haystack)) orphans.push(rel);
  }
  return orphans.sort();
}

// ---------------------------------------------------------------------------
// 3. STATE.md

function renderState() {
  const pkg = JSON.parse(read(join(ROOT, "package.json")) || "{}");
  const logs = datedLogs();
  const decisions = decisionsIndex();
  const open = issuesIndex("Known Issues.md").filter((r) => !r.resolved);
  const resolved = [
    ...issuesIndex("Known Issues.md").filter((r) => r.resolved),
    ...issuesIndex("Known Issues Archive.md"),
  ];
  const orphans = orphanModules();

  const branch = git("branch", "--show-current") || "(detached)";
  const head = git("log", "-1", "--format=%h %s");

  const out = [];
  const p = (...l) => out.push(...l);

  p("# STATE — generated, do not hand-edit");
  p("");
  p("<!-- GENERATED by scripts/context-gen.mjs. Hand edits are blocked by .claude/hooks/context-gate.sh -->");
  p("");
  p("Everything here is derived from the repo, so it cannot go stale the way hand-typed");
  p("status does. **Live branch/PR/release status is NOT here** — it is injected fresh each");
  p("session by the SessionStart hook, because a committed file cannot know today's truth.");
  p("");
  p("---");
  p("");
  p("## Build");
  p("");
  p(`- **App version:** \`${pkg.version ?? "?"}\` (package.json)`);
  p(`- **Releases publish to:** \`bandidoseb/wingman-releases\` (PUBLIC, separate from the source repo)`);
  p(`- **Branch at last generate:** \`${branch}\` · ${head}`);
  p("");

  if (orphans.length) {
    p("## Orphan modules — zero inbound imports");
    p("");
    p("Computed, not remembered. If something here is documented as live anywhere, the doc is wrong.");
    p("");
    for (const o of orphans) p(`- \`${o}\``);
    p("");
  }

  p(`## Open issues (${open.length})`);
  p("");
  p("Full text + root-cause notes: `Wingman Brain/01 - Build Log/Known Issues.md`");
  p("");
  for (const r of open) p(`- **#${r.num}** — ${r.title}`);
  p("");

  p(`## Resolved issues (${resolved.length}) — index only`);
  p("");
  p("Root-cause write-ups live in `Known Issues Archive.md`. Several are load-bearing");
  p("(#53 Chromium background-timer throttling, #58 `npm run build` killing the dev server,");
  p("#60 `res.json()` typed `any`) — search the archive before re-diagnosing anything similar.");
  p("");
  for (const r of resolved) p(`- #${r.num} — ${r.title}`);
  p("");

  p(`## Decisions (${decisions.length}) — index only`);
  p("");
  p("Full entries: `Wingman Brain/01 - Build Log/Decisions Log.md`. **Read it before**");
  p("**re-opening any architecture question** — that is what it is for. ⚠️ = superseded.");
  p("");
  for (const d of decisions) p(`- ${d.superseded ? "⚠️ " : ""}${d.title}`);
  p("");

  p(`## Build logs (${logs.length}) — index only`);
  p("");
  p("Full narrative per session: `Wingman Brain/01 - Build Log/YYYY-MM-DD.md`");
  p("");
  for (const l of logs) p(`- **${l.date}** — ${l.summary}`);
  p("");

  return out.join("\n");
}

// ---------------------------------------------------------------------------

const targets = [
  { path: join(BUILD_LOG_DIR, "Build Log.md"), content: renderBuildLogIndex(datedLogs()) },
  { path: join(CONTEXT_DIR, "STATE.md"), content: renderState() },
];

let drift = false;
for (const t of targets) {
  const rel = relative(ROOT, t.path);
  const next = t.content.endsWith("\n") ? t.content : t.content + "\n";
  const prev = read(t.path);

  if (CHECK_ONLY) {
    if (prev !== next) {
      drift = true;
      console.error(`✗ context-gen: ${rel} is out of date. Run: npm run context:gen`);
    }
    continue;
  }

  writeFileSync(t.path, next);
  const kb = (next.length / 1024).toFixed(1);
  console.log(`✓ ${rel} — ${next.split("\n").length} lines, ${kb}KB`);
}

if (CHECK_ONLY && drift) process.exit(1);
if (CHECK_ONLY) console.log("✓ context-gen: generated files are up to date.");
