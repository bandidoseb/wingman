/**
 * objection-eval.mjs — 3-arm objection-card eval with an AI judge.
 *
 *   node scripts/objection-eval.mjs            # full run (30 scenarios x 3 arms)
 *   LIMIT=5 node scripts/objection-eval.mjs    # first 5 scenarios only
 *   DRY=1 node scripts/objection-eval.mjs      # no API calls — prove assembly + report
 *   OBJ_MODEL=… JUDGE_MODEL=… node scripts/objection-eval.mjs
 *
 * Arms:
 *   A = v1 prompt, inputs = context + transcript          (today's baseline)
 *   B = v2 prompt, inputs = context + transcript          (does the rewrite help?)
 *   C = v2 prompt, inputs = context + transcript + anchors (do anchors help?)  ← prod candidate
 *
 * The judge is BLIND to which arm produced a line. It always sees the scenario's
 * ground-truth context + anchors, so fabrication ("stated a specific the call facts
 * don't support") and shaky-number leaks are caught for every arm.
 *
 * Sebastian is the FINAL tonality judge — the AI scores are triage/volume.
 *
 * Writes tasks/kb-ab-test/objection-eval-results.md + .json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { V1_SYSTEM_PROMPT, V2_SYSTEM_PROMPT, V3_MERGED_PROMPT, buildUserMessage, formatAnchors } from "./objection-prompts.mjs";
import { SCENARIOS } from "./objection-eval-corpus.mjs";
import { COMPACT } from "./objection-eval-compact.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../tasks/kb-ab-test");

function loadEnv() {
  const text = readFileSync(join(__dirname, "../.env.local"), "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv();

const DRY = !!process.env.DRY;
const COMPACT_MODE = !!process.env.COMPACT;
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : SCENARIOS.length;
const OBJ_MODEL = process.env.OBJ_MODEL || "claude-sonnet-4-6";
const JUDGE_MODEL = process.env.JUDGE_MODEL || "claude-sonnet-4-6";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!DRY && !ANTHROPIC_KEY) { console.error("Missing ANTHROPIC_API_KEY (or run with DRY=1)"); process.exit(1); }

// Phase 0 arms: v1 = tonality baseline; P/PA = the merged production candidate
// (v1 tonality + the no-fabrication/number fence) without/with the anchor library.
// V1 vs P  → did the safety merge cost any tonality?
// P  vs PA → do anchors help, and is the merged prompt fabrication-safe with them?
const ARMS = [
  { key: "V1", label: "v1 (tonality baseline)",   system: V1_SYSTEM_PROMPT, anchors: false },
  { key: "P",  label: "merged prod (no anchors)", system: V3_MERGED_PROMPT, anchors: false },
  { key: "PA", label: "merged prod + anchors",    system: V3_MERGED_PROMPT, anchors: true  },
];

// ── Anthropic call with one retry on overload/rate-limit ─────────────────────
async function anthropic(model, system, userContent, maxTokens) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 30_000);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: userContent }] }),
        signal: controller.signal,
      });
      if (resp.status === 429 || resp.status === 529) {
        if (attempt === 0) { await new Promise((r) => setTimeout(r, 3000)); continue; }
        return { error: `${resp.status} overloaded` };
      }
      if (!resp.ok) return { error: `${resp.status}` };
      const text = (await resp.json()).content?.[0]?.text?.trim() ?? "";
      return { text };
    } catch (e) {
      if (attempt === 0 && e?.name !== "AbortError") { await new Promise((r) => setTimeout(r, 1500)); continue; }
      return { error: e?.name === "AbortError" ? "timeout" : (e?.message || "fetch error") };
    } finally { clearTimeout(t); }
  }
  return { error: "unreachable" };
}

// Tolerant JSON extraction — pull the first {...} block, then a keyed value as last resort.
function extractJson(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return null;
}

// ── Generate one card ────────────────────────────────────────────────────────
async function generateCard(scenario, arm) {
  if (DRY) return { line: `(dry) ${arm.key} card for #${scenario.id} "${scenario.objection}"` };
  // In compact mode the card sees a thin, production-like summary instead of the rich
  // discovery dump — so anchors (arm C/D) actually have specifics to add. Judge still
  // grades against the full scenario, so fabrication is caught either way.
  const genScenario = COMPACT_MODE ? { ...scenario, context: COMPACT[scenario.id] || scenario.context } : scenario;
  const user = buildUserMessage(genScenario, { withAnchors: arm.anchors });
  const { text, error } = await anthropic(OBJ_MODEL, arm.system, user, 400);
  if (error) return { line: null, error };
  const parsed = extractJson(text);
  if (parsed && typeof parsed.line === "string") return { line: parsed.line.trim() };
  const m = text.match(/"line"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m) return { line: m[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim() };
  return { line: null, error: "unparseable", raw: text.slice(0, 160) };
}

// ── Judge one card (blind to arm) ────────────────────────────────────────────
const JUDGE_SYSTEM = `You are a strict, fair grader of objection-handling lines for a live high-ticket sales copilot. The line is what a rep reads ONCE and says OUT LOUD to a prospect, in real time, right after the prospect raised an objection. Grade ONLY against the GROUND TRUTH provided (the call facts + the prospect's real anchors). You do not know which system produced the line — judge the line on its merits.

Score these dimensions:
- tonality (0-5): does it sound like a calm, human, elite closer talking? 5 = indistinguishable from a top closer. 0 = robotic / formal / reads like AI or an email.
- brevity (0-2): 2 = ~25 words or fewer, <=2 short sentences; 1 = a bit long; 0 = a paragraph.
- one_beat (0-2): 2 = ONE move (a pace+tie-down, OR one reframe, OR one question); 0 = stacks multiple moves into one line.
- anchored (0-2): 2 = ties to a REAL detail from the ground truth (their pain/goal/why/quote); 1 = generic but fine; 0 = generic filler when a real anchor was available.
- right_belief (0-2): 2 = addresses the actual weak belief behind THIS objection; 0 = misreads it.
- no_windup (0-2): 2 = jumps straight to substance, OR opens with a natural human pace or a permission-ask that real closers are coached to use ("I hear you", "yeah, totally", "can I be honest for a sec?", "can I share something?", "can I make a suggestion?"). 0 = AI-style wind-up that NAMES what it's about to do or feel ("I'm sensing some hesitation...", "I'm curious what's driving...", "It sounds like you might want..."). IMPORTANT: brief warm paces and permission-asks are GOOD and must NOT be penalized — only penalize the self-narrating AI wind-up.

Hard flags (these are trust-killers — judge them carefully against the ground truth):
- fabrication (true/false): TRUE if the line states ANY specific — a number, a quote, a name, a fact — that is NOT supported by the ground truth, OR alters/sharpens one (e.g. says "$80k" when truth says "$50k", or invents a quote they never said). When in doubt that a stated specific is grounded, mark TRUE.
- said_shaky_number (true/false): TRUE if the line states the digits of a number whose anchor is marked [shaky] (those should be left vague — lean on the meaning, not the figure). FALSE if no shaky number's digits appear.

Return ONLY this JSON object, nothing else:
{ "tonality": n, "brevity": n, "one_beat": n, "anchored": n, "right_belief": n, "no_windup": n, "fabrication": true|false, "said_shaky_number": true|false, "rationale": "one short sentence" }`;

function judgeUser(scenario, line) {
  return `GROUND TRUTH — call facts:\n${scenario.context}\n\n` +
         `GROUND TRUTH — prospect anchors (with confidence):\n${formatAnchors(scenario.anchors)}\n\n` +
         `THE OBJECTION: "${scenario.objection}"\n\n` +
         `THE LINE TO GRADE: "${line}"`;
}

const ZERO = { tonality: 0, brevity: 0, one_beat: 0, anchored: 0, right_belief: 0, no_windup: 0, fabrication: false, said_shaky_number: false, rationale: "" };

async function judgeCard(scenario, line) {
  if (line == null) return { ...ZERO, rationale: "no card generated", _failed: true };
  if (DRY) return { tonality: 3, brevity: 2, one_beat: 2, anchored: 1, right_belief: 2, no_windup: 2, fabrication: false, said_shaky_number: false, rationale: "(dry stub)" };
  const { text, error } = await anthropic(JUDGE_MODEL, JUDGE_SYSTEM, judgeUser(scenario, line), 400);
  if (error) return { ...ZERO, rationale: `judge error: ${error}`, _failed: true };
  const p = extractJson(text);
  if (!p) return { ...ZERO, rationale: "judge unparseable", _failed: true };
  const num = (v, max) => Math.max(0, Math.min(max, Number(v) || 0));
  return {
    tonality: num(p.tonality, 5),
    brevity: num(p.brevity, 2),
    one_beat: num(p.one_beat, 2),
    anchored: num(p.anchored, 2),
    right_belief: num(p.right_belief, 2),
    no_windup: num(p.no_windup, 2),
    fabrication: !!p.fabrication,
    said_shaky_number: !!p.said_shaky_number,
    rationale: String(p.rationale || "").slice(0, 240),
  };
}

// composite out of 20 (tonality weighted x2). fabrication/shaky-number = trust fail → 0 for ranking.
function composite(s) {
  if (s.fabrication || s.said_shaky_number) return 0;
  return s.tonality * 2 + s.brevity + s.one_beat + s.anchored + s.right_belief + s.no_windup;
}

async function run() {
  const scenarios = SCENARIOS.slice(0, LIMIT);
  console.log(`${DRY ? "[DRY] " : ""}Running ${scenarios.length} scenarios x ${ARMS.length} arms` +
              `${DRY ? " (no API calls)" : ` — gen=${OBJ_MODEL}, judge=${JUDGE_MODEL}`}\n`);

  const rows = []; // { id, objection, category, arms: { A:{line,score}, ... } }
  for (const s of scenarios) {
    const cards = await Promise.all(ARMS.map((a) => generateCard(s, a)));
    const scores = await Promise.all(ARMS.map((a, i) => judgeCard(s, cards[i].line)));
    const armOut = {};
    ARMS.forEach((a, i) => { armOut[a.key] = { line: cards[i].line, error: cards[i].error, score: scores[i] }; });
    rows.push({ id: s.id, objection: s.objection, category: s.category, arms: armOut });
    const tag = ARMS.map((a) => `${a.key}:${composite(armOut[a.key].score)}`).join(" ");
    console.log(`#${String(s.id).padStart(2)} ${tag}  "${s.objection}"`);
  }

  // ── Aggregate ──────────────────────────────────────────────────────────────
  const agg = {};
  for (const a of ARMS) agg[a.key] = { tonality: 0, brevity: 0, one_beat: 0, anchored: 0, right_belief: 0, no_windup: 0, composite: 0, fabrication: 0, shaky: 0, n: 0 };
  for (const r of rows) for (const a of ARMS) {
    const s = r.arms[a.key].score, g = agg[a.key];
    g.tonality += s.tonality; g.brevity += s.brevity; g.one_beat += s.one_beat;
    g.anchored += s.anchored; g.right_belief += s.right_belief; g.no_windup += s.no_windup;
    g.composite += composite(s); g.fabrication += s.fabrication ? 1 : 0; g.shaky += s.said_shaky_number ? 1 : 0; g.n++;
  }
  const avg = (x, n) => (n ? (x / n).toFixed(2) : "—");

  // ── Markdown report ─────────────────────────────────────────────────────────
  const md = [];
  md.push("# Objection Card Eval — v1 vs v2 vs v2+anchors");
  md.push("");
  md.push(`Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} · ${scenarios.length} scenarios · gen=\`${OBJ_MODEL}\` · judge=\`${JUDGE_MODEL}\`${DRY ? " · **DRY (stub scores)**" : ""}${COMPACT_MODE ? " · **COMPACT MODE**" : ""}`);
  md.push("");
  if (COMPACT_MODE) md.push("**COMPACT MODE:** the card sees a thin, production-like belief-ladder summary (not the rich discovery dump). So **A vs D (both v1, no-anchors vs +anchors) is the real anchor test.** Judge grades against full ground truth, so fabrication is still caught.\n");
  md.push("**Arms:** A = v1 (current prompt) · B = v2 (no anchors) · C = v2 + anchors · D = v1 + anchors.");
  md.push("> The AI judge is triage for volume. **Sebastian is the final tonality judge** — read the lines.");
  md.push("> `fabrication` and `shaky #` are trust-killers: any card with one scores **composite 0** (out of 20).");
  md.push("");
  md.push("## Scoreboard (averages)");
  md.push("");
  md.push("| Arm | Composite /20 | Tonality /5 | Brevity /2 | One-beat /2 | Anchored /2 | Right-belief /2 | No-windup /2 | Fabrications | Shaky # leaks |");
  md.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const a of ARMS) {
    const g = agg[a.key];
    md.push(`| **${a.key}** ${a.label} | ${avg(g.composite, g.n)} | ${avg(g.tonality, g.n)} | ${avg(g.brevity, g.n)} | ${avg(g.one_beat, g.n)} | ${avg(g.anchored, g.n)} | ${avg(g.right_belief, g.n)} | ${avg(g.no_windup, g.n)} | ${g.fabrication} | ${g.shaky} |`);
  }
  md.push("");

  // Critical incidents first — the cards that would embarrass a rep.
  const incidents = [];
  for (const r of rows) for (const a of ARMS) {
    const s = r.arms[a.key].score;
    if (s.fabrication || s.said_shaky_number) {
      incidents.push(`- **#${r.id} arm ${a.key}** ${s.fabrication ? "🚨 FABRICATION" : ""}${s.said_shaky_number ? " ⚠️ SHAKY #" : ""} — "${r.arms[a.key].line}"  _(${s.rationale})_`);
    }
  }
  md.push("## 🚨 Trust-killer incidents (fabrication / shaky-number leaks)");
  md.push("");
  md.push(incidents.length ? incidents.join("\n") : "_None — no arm invented or leaked a shaky number._");
  md.push("");

  md.push("## Per-scenario (cards side by side)");
  md.push("");
  for (const r of rows) {
    md.push(`### #${r.id} — "${r.objection}"  _(${r.category})_`);
    md.push("");
    for (const a of ARMS) {
      const c = r.arms[a.key], s = c.score;
      const flags = [s.fabrication ? "🚨FAB" : "", s.said_shaky_number ? "⚠️SHAKY#" : ""].filter(Boolean).join(" ");
      md.push(`- **${a.key}** (${composite(s)}/20${flags ? " " + flags : ""}): ${c.line == null ? `_(no card — ${c.error})_` : c.line}`);
      md.push(`  <sub>tone ${s.tonality} · brev ${s.brevity} · 1-beat ${s.one_beat} · anchor ${s.anchored} · belief ${s.right_belief} · no-windup ${s.no_windup} — ${s.rationale}</sub>`);
    }
    md.push("");
  }

  const outBase = COMPACT_MODE ? "objection-eval-compact-results" : "objection-eval-results";
  writeFileSync(join(OUT, `${outBase}.md`), md.join("\n"));
  writeFileSync(join(OUT, `${outBase}.json`), JSON.stringify({ meta: { date: new Date().toISOString(), objModel: OBJ_MODEL, judgeModel: JUDGE_MODEL, dry: DRY, compact: COMPACT_MODE, n: scenarios.length }, agg, rows }, null, 2));

  console.log("\n── Scoreboard (composite /20, fewer fabrications = better) ──");
  for (const a of ARMS) console.log(`  ${a.key} ${a.label.padEnd(22)} comp ${avg(agg[a.key].composite, agg[a.key].n)}  fab ${agg[a.key].fabrication}  shaky ${agg[a.key].shaky}`);
  console.log(`\nWrote tasks/kb-ab-test/${outBase}.md (+ .json)`);

  if (DRY) {
    console.log("\n[DRY] Sample assembled prompt — arm C, scenario #1 (system + user):\n");
    console.log("──── SYSTEM (v2) ────\n" + V2_SYSTEM_PROMPT.slice(0, 500) + "\n…(truncated)…\n");
    const sample = COMPACT_MODE ? { ...SCENARIOS[0], context: COMPACT[SCENARIOS[0].id] } : SCENARIOS[0];
    console.log(`──── USER (with anchors${COMPACT_MODE ? ", COMPACT summary" : ""}) ────\n` + buildUserMessage(sample, { withAnchors: true }));
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
