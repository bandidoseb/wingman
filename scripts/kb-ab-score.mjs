/**
 * kb-ab-score.mjs — scores the blind grading sheet against the hidden answer key.
 *
 *   1. Grade tasks/kb-ab-test/grading-sheet.md
 *   2. Put your picks in tasks/kb-ab-test/picks.txt  (e.g. "1:3 2:1 3:4 ..." — id:card)
 *   3. node scripts/kb-ab-score.mjs
 *
 * Writes tasks/kb-ab-test/results.md: win tally per arm (overall + on the KB-hit
 * subset, which is the only place the KB can matter), per-category winners, and a
 * dump of every KB entry that actually fired (technique + similarity + script) so
 * the low-quality entries surface themselves. Deterministic — no eyeballing.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, "../tasks/kb-ab-test");

const ARM_LABEL = { A: "KB", B: "Free (no KB)", C: "Like Miner", D: "Like Gordon" };

const answerKey = JSON.parse(readFileSync(join(DIR, "answer-key.json"), "utf8"));

// Picks come from the grader page (grades.json — preferred, includes notes) or a
// plain picks.txt ("1:3 2:1 ..."). Try the page output first.
const picks = new Map();   // objection id -> card position (number) | "x"
const notes = new Map();   // objection id -> free-text thought

let loaded = false;
try {
  const g = JSON.parse(readFileSync(join(DIR, "grades.json"), "utf8"));
  for (const [id, v] of Object.entries(g.picks ?? {})) {
    picks.set(Number(id), v === "x" || v === "X" ? "x" : Number(v));
  }
  for (const [id, v] of Object.entries(g.notes ?? {})) {
    if (v && String(v).trim()) notes.set(Number(id), String(v).trim());
  }
  loaded = true;
  console.log(`Read grades.json (${picks.size} picks, ${notes.size} notes).`);
} catch { /* no grades.json — try picks.txt */ }

if (!loaded) {
  let picksText = "";
  try {
    picksText = readFileSync(join(DIR, "picks.txt"), "utf8");
  } catch {
    console.error("No grades.json or picks.txt found.\n  • Grade in grader.html → Copy results → save the JSON as tasks/kb-ab-test/grades.json\n  • Or write picks.txt: \"1:3 2:1 3:4 ...\" (id:card, 1-4, or x)");
    process.exit(1);
  }
  for (const m of picksText.matchAll(/(\d+)\s*:\s*([1-4xX])/g)) {
    picks.set(Number(m[1]), m[2].toLowerCase());
  }
}

const byId = new Map(answerKey.map((r) => [r.id, r]));

const wins = { A: 0, B: 0, C: 0, D: 0 };
const winsKbHit = { A: 0, B: 0, C: 0, D: 0 };
const catWins = {}; // category → { A,B,C,D }
const perObjection = [];
let allBad = 0, missing = 0, kbHitGraded = 0;

for (const r of answerKey) {
  const pick = picks.get(r.id);
  if (!pick)        { missing++;  perObjection.push({ id: r.id, objection: r.objection, winner: "—", note: "no pick" }); continue; }
  if (pick === "x") { allBad++;   perObjection.push({ id: r.id, objection: r.objection, winner: "x", note: "all bad" }); continue; }

  const cardIdx = Number(pick) - 1;
  const arm = r.order[cardIdx];            // order[i] = arm shown as Card (i+1)
  if (!arm) { missing++; continue; }

  wins[arm]++;
  catWins[r.category] ??= { A: 0, B: 0, C: 0, D: 0 };
  catWins[r.category][arm]++;
  if (r.kbHit) { winsKbHit[arm]++; kbHitGraded++; }

  perObjection.push({
    id: r.id,
    objection: r.objection,
    winner: `${arm} — ${ARM_LABEL[arm]}`,
    kbHit: r.kbHit,
    note: r.kbHit && arm !== "A" ? "KB fired but lost" : r.kbHit ? "KB fired and won" : "KB silent",
  });
}

const graded = answerKey.length - missing;
const kbHits = answerKey.filter((r) => r.kbHit).length;
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : "—");

const out = [];
out.push("# KB A/B — Results");
out.push("");
out.push(`Graded **${graded}/${answerKey.length}** objections.` + (allBad ? `  (${allBad} marked all-bad, ${missing} missing.)` : missing ? `  (${missing} missing.)` : ""));
out.push("");
out.push("## Win tally — overall");
out.push("");
out.push("| Arm | Wins | Share |");
out.push("|---|---|---|");
for (const k of ["A", "B", "C", "D"]) out.push(`| ${ARM_LABEL[k]} | ${wins[k]} | ${pct(wins[k], graded - allBad)} |`);
out.push("");
out.push(`**KB fired on ${kbHits}/${answerKey.length} objections.** The KB can only matter where it fired — so this is the decisive cut:`);
out.push("");
out.push(`## Win tally — KB-hit objections only (${kbHitGraded} graded)`);
out.push("");
out.push("| Arm | Wins | Share |");
out.push("|---|---|---|");
for (const k of ["A", "B", "C", "D"]) out.push(`| ${ARM_LABEL[k]} | ${winsKbHit[k]} | ${pct(winsKbHit[k], kbHitGraded)} |`);
out.push("");
out.push("> If **KB** does not clearly win this table, the knowledge base is not earning its place in the live path — Claude does as well or better without it.");
out.push("");

out.push("## Per-objection winner");
out.push("");
out.push("| # | Objection | Winner | KB status |");
out.push("|---|---|---|---|");
for (const p of perObjection) {
  out.push(`| ${p.id} | ${p.objection} | ${p.winner} | ${p.note ?? ""} |`);
}
out.push("");

out.push("## Per-category winner");
out.push("");
out.push("| Category | KB | Free | Miner | Gordon |");
out.push("|---|---|---|---|---|");
for (const [cat, w] of Object.entries(catWins).sort()) {
  out.push(`| ${cat} | ${w.A} | ${w.B} | ${w.C} | ${w.D} |`);
}
out.push("");

out.push("## The KB entries that actually fired");
out.push("");
out.push("This is the reveal of your \"could be shit in there\" worry — every entry the KB");
out.push("retrieved for a common objection, with its similarity. Low similarity = a loose,");
out.push("possibly off-target match the live system would have forced onto the card.");
out.push("");
for (const r of answerKey) {
  if (!r.kbHit) continue;
  out.push(`### #${r.id} "${r.objection}"  → distilled query: "${r.grounding}"`);
  out.push("");
  r.kbEntries.forEach((e, i) => {
    const flag = e.similarity < 0.65 ? "  ⚠️ LOW" : "";
    out.push(`- **${e.technique_name}** — sim ${e.similarity.toFixed(3)}${flag}  _(stage: ${e.call_stage}; trigger matched: "${e.matched_trigger}")_`);
    if (i === 0 && e.exact_script) out.push(`    - script: ${e.exact_script}`);
  });
  out.push("");
}

out.push("## Objections where the KB stayed silent (already running KB-free in production)");
out.push("");
const silent = answerKey.filter((r) => !r.kbHit).map((r) => `#${r.id} "${r.objection}"`);
out.push(silent.length ? silent.join(" · ") : "_(none — KB fired on all)_");
out.push("");

if (notes.size) {
  out.push("## Your notes (with the arm you picked, revealed)");
  out.push("");
  for (const r of answerKey) {
    const n = notes.get(r.id);
    if (!n) continue;
    const p = perObjection.find((x) => x.id === r.id);
    out.push(`- **#${r.id} "${r.objection}"** — picked _${p?.winner ?? "—"}_: ${n}`);
  }
  out.push("");
}

writeFileSync(join(DIR, "results.md"), out.join("\n"));
console.log(`Scored ${graded}/${answerKey.length}. Wrote tasks/kb-ab-test/results.md`);
console.log(`Overall — KB:${wins.A}  Free:${wins.B}  Miner:${wins.C}  Gordon:${wins.D}`);
console.log(`KB-hit only — KB:${winsKbHit.A}  Free:${winsKbHit.B}  Miner:${winsKbHit.C}  Gordon:${winsKbHit.D}  (of ${kbHitGraded})`);
