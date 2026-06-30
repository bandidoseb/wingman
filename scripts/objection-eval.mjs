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

// PROD = exactly what ships after Groq is removed: the real production prompt (single source
// of truth), objection INFERRED from the transcript (not handed in), 150-token cap. The
// HINT-vs-INFER comparison from 2026-06-30 already proved removing Groq is safe (INFER ≥ HINT,
// right-belief perfect), so we now grade only the production arm. This run also tests ABSTAIN:
// no-objection scenarios (expectAbstain) must come back { "line": null }; real ones must not.
const ARMS = [
  { key: "PROD", label: "production (objection inferred, Groq removed)", system: V3_MERGED_PROMPT, anchors: false, omitObjection: true },
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
  const user = buildUserMessage(genScenario, { withAnchors: arm.anchors, omitObjection: arm.omitObjection });
  // 150 tokens = production cap (was 400) — keep the gate faithful to what ships.
  const { text, error } = await anthropic(OBJ_MODEL, arm.system, user, 150);
  if (error) return { line: null, error };
  const parsed = extractJson(text);
  if (parsed && typeof parsed.line === "string") return { line: parsed.line.trim() };
  // Valid ABSTAIN — { "line": null } — is a deliberate "no objection detected," NOT a failure.
  if (parsed && parsed.line === null) return { line: null, abstained: true };
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
  const all = SCENARIOS.slice(0, LIMIT);
  const realScenarios    = all.filter((s) => !s.expectAbstain);
  const abstainScenarios = all.filter((s) =>  s.expectAbstain);
  console.log(`${DRY ? "[DRY] " : ""}Running ${realScenarios.length} real + ${abstainScenarios.length} no-objection scenarios x ${ARMS.length} arm` +
              `${DRY ? " (no API calls)" : ` — gen=${OBJ_MODEL}, judge=${JUDGE_MODEL}`}\n`);

  // ── Real objection scenarios: generate + judge. A real scenario that ABSTAINS
  //    is a FALSE SILENCE (missed a live objection) — the worst failure here. ────
  const rows = [];
  const falseAbstain = {}; for (const a of ARMS) falseAbstain[a.key] = 0;
  for (const s of realScenarios) {
    const cards = await Promise.all(ARMS.map((a) => generateCard(s, a)));
    const scores = await Promise.all(ARMS.map((a, i) => judgeCard(s, cards[i].line)));
    const armOut = {};
    ARMS.forEach((a, i) => {
      if (cards[i].abstained) falseAbstain[a.key]++;
      armOut[a.key] = { line: cards[i].line, error: cards[i].error, abstained: !!cards[i].abstained, score: scores[i] };
    });
    rows.push({ id: s.id, objection: s.objection, category: s.category, arms: armOut });
    const tag = ARMS.map((a) => `${a.key}:${armOut[a.key].abstained ? "ABSTAIN✗" : composite(armOut[a.key].score)}`).join(" ");
    console.log(`#${String(s.id).padStart(2)} ${tag}  "${s.objection}"`);
  }

  // ── No-objection scenarios: the card MUST abstain ({ "line": null }). ────────
  const abstainRows = [];
  const abstainCorrect = {}; for (const a of ARMS) abstainCorrect[a.key] = 0;
  for (const s of abstainScenarios) {
    const cards = await Promise.all(ARMS.map((a) => generateCard(s, a)));
    const armOut = {};
    ARMS.forEach((a, i) => {
      if (cards[i].abstained) abstainCorrect[a.key]++;
      armOut[a.key] = { abstained: !!cards[i].abstained, line: cards[i].line, error: cards[i].error };
    });
    abstainRows.push({ id: s.id, objection: s.objection, category: s.category, arms: armOut });
    const tag = ARMS.map((a) => `${a.key}:${armOut[a.key].abstained ? "ABSTAIN✓" : "HANDLED✗"}`).join(" ");
    console.log(`#${String(s.id).padStart(2)} ${tag}  "${s.objection}"  (expect abstain)`);
  }

  // ── Aggregate quality over HANDLED real scenarios only (a false-abstain is
  //    tracked separately, not folded into the tonality/composite average). ─────
  const agg = {};
  for (const a of ARMS) agg[a.key] = { tonality: 0, brevity: 0, one_beat: 0, anchored: 0, right_belief: 0, no_windup: 0, composite: 0, fabrication: 0, shaky: 0, n: 0 };
  for (const r of rows) for (const a of ARMS) {
    if (r.arms[a.key].abstained) continue;
    const s = r.arms[a.key].score, g = agg[a.key];
    g.tonality += s.tonality; g.brevity += s.brevity; g.one_beat += s.one_beat;
    g.anchored += s.anchored; g.right_belief += s.right_belief; g.no_windup += s.no_windup;
    g.composite += composite(s); g.fabrication += s.fabrication ? 1 : 0; g.shaky += s.said_shaky_number ? 1 : 0; g.n++;
  }
  const avg = (x, n) => (n ? (x / n).toFixed(2) : "—");

  // ── GATE: PASS requires no false silence, correct abstains, zero fabrication,
  //    and tonality holding the locked ~4.9 baseline (≥4.7 margin). ─────────────
  const gate = [];
  const gatePass = {};
  for (const a of ARMS) {
    const tone = agg[a.key].n ? agg[a.key].tonality / agg[a.key].n : 0;
    const gA = falseAbstain[a.key] === 0;                                   // never silent on a real objection
    const gB = abstainCorrect[a.key] === abstainScenarios.length;          // abstains on every no-objection
    const gC = agg[a.key].fabrication === 0 && agg[a.key].shaky === 0;      // no trust-killers
    const gD = tone >= 4.7;                                                 // tonality held
    gatePass[a.key] = gA && gB && gC && gD;
    gate.push(`- **${a.key}: ${gatePass[a.key] ? "✅ PASS" : "❌ FAIL"}** — ` +
      `no false silence on real objections ${gA ? "✅" : `❌ (${falseAbstain[a.key]})`} · ` +
      `abstains on no-objection ${gB ? "✅" : "❌"} (${abstainCorrect[a.key]}/${abstainScenarios.length}) · ` +
      `zero fabrications ${gC ? "✅" : "❌"} · tonality ≥4.7 ${gD ? "✅" : "❌"} (${tone.toFixed(2)})`);
  }

  // ── Markdown report ─────────────────────────────────────────────────────────
  const md = [];
  md.push("# Objection Card Eval — production prompt + abstain gate");
  md.push("");
  md.push(`Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} · ${realScenarios.length} real + ${abstainScenarios.length} no-objection · gen=\`${OBJ_MODEL}\` · judge=\`${JUDGE_MODEL}\`${DRY ? " · **DRY (stub scores)**" : ""}`);
  md.push("");
  md.push("**PROD arm** = the real production prompt (single source of truth), objection inferred from the transcript (Groq removed), 150-token cap.");
  md.push("> The AI judge is triage for volume. **Sebastian is the final tonality judge** — read the lines.");
  md.push("> `fabrication`/`shaky #` are trust-killers (composite 0). `expectAbstain` scenarios MUST return `{ line: null }`.");
  md.push("");
  md.push("## ✅/❌ GATE");
  md.push("");
  md.push(gate.join("\n"));
  md.push("");
  md.push("## Scoreboard — handled real objections (averages)");
  md.push("");
  md.push("| Arm | Composite /20 | Tonality /5 | Brevity /2 | One-beat /2 | Anchored /2 | Right-belief /2 | No-windup /2 | Fabrications | Shaky # leaks | False-silence |");
  md.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const a of ARMS) {
    const g = agg[a.key];
    md.push(`| **${a.key}** ${a.label} | ${avg(g.composite, g.n)} | ${avg(g.tonality, g.n)} | ${avg(g.brevity, g.n)} | ${avg(g.one_beat, g.n)} | ${avg(g.anchored, g.n)} | ${avg(g.right_belief, g.n)} | ${avg(g.no_windup, g.n)} | ${g.fabrication} | ${g.shaky} | ${falseAbstain[a.key]} |`);
  }
  md.push("");

  // Critical incidents first — the cards that would embarrass a rep.
  const incidents = [];
  for (const r of rows) for (const a of ARMS) {
    const s = r.arms[a.key].score;
    if (r.arms[a.key].abstained) {
      incidents.push(`- **#${r.id} arm ${a.key}** 🔇 FALSE SILENCE — abstained on a real objection: "${r.objection}"`);
    } else if (s.fabrication || s.said_shaky_number) {
      incidents.push(`- **#${r.id} arm ${a.key}** ${s.fabrication ? "🚨 FABRICATION" : ""}${s.said_shaky_number ? " ⚠️ SHAKY #" : ""} — "${r.arms[a.key].line}"  _(${s.rationale})_`);
    }
  }
  md.push("## 🚨 Critical incidents (fabrication / shaky-number / false-silence)");
  md.push("");
  md.push(incidents.length ? incidents.join("\n") : "_None — no fabrication, no shaky number, no false silence._");
  md.push("");

  md.push("## Abstain check — no-objection scenarios (must return `{ line: null }`)");
  md.push("");
  for (const r of abstainRows) {
    md.push(`### #${r.id} — "${r.objection}"  _(${r.category})_`);
    for (const a of ARMS) {
      const c = r.arms[a.key];
      md.push(`- **${a.key}**: ${c.abstained ? "✅ ABSTAINED" : `❌ HANDLED — "${c.line ?? "(" + c.error + ")"}"`}`);
    }
    md.push("");
  }

  md.push("## Per-scenario — real objections (cards)");
  md.push("");
  for (const r of rows) {
    md.push(`### #${r.id} — "${r.objection}"  _(${r.category})_`);
    md.push("");
    for (const a of ARMS) {
      const c = r.arms[a.key], s = c.score;
      if (c.abstained) { md.push(`- **${a.key}** 🔇 FALSE SILENCE (abstained on a real objection)`); continue; }
      const flags = [s.fabrication ? "🚨FAB" : "", s.said_shaky_number ? "⚠️SHAKY#" : ""].filter(Boolean).join(" ");
      md.push(`- **${a.key}** (${composite(s)}/20${flags ? " " + flags : ""}): ${c.line == null ? `_(no card — ${c.error})_` : c.line}`);
      md.push(`  <sub>tone ${s.tonality} · brev ${s.brevity} · 1-beat ${s.one_beat} · anchor ${s.anchored} · belief ${s.right_belief} · no-windup ${s.no_windup} — ${s.rationale}</sub>`);
    }
    md.push("");
  }

  const outBase = "objection-eval-results";
  writeFileSync(join(OUT, `${outBase}.md`), md.join("\n"));
  writeFileSync(join(OUT, `${outBase}.json`), JSON.stringify({ meta: { date: new Date().toISOString(), objModel: OBJ_MODEL, judgeModel: JUDGE_MODEL, dry: DRY, nReal: realScenarios.length, nAbstain: abstainScenarios.length }, gatePass, agg, falseAbstain, abstainCorrect, rows, abstainRows }, null, 2));

  console.log("\n── GATE ──");
  console.log(gate.join("\n").replace(/\*\*/g, ""));
  console.log("\n── Quality (handled real objections) ──");
  for (const a of ARMS) console.log(`  ${a.key}  comp ${avg(agg[a.key].composite, agg[a.key].n)}  tone ${avg(agg[a.key].tonality, agg[a.key].n)}  fab ${agg[a.key].fabrication}  shaky ${agg[a.key].shaky}  false-silence ${falseAbstain[a.key]}`);
  console.log(`  abstain accuracy: ${ARMS.map((a) => `${a.key} ${abstainCorrect[a.key]}/${abstainScenarios.length}`).join(" · ")}`);
  console.log(`\nWrote tasks/kb-ab-test/${outBase}.md (+ .json)`);

  if (DRY) {
    console.log("\n[DRY] Sample assembled prompt — PROD arm, scenario #1 (system + user):\n");
    console.log("──── SYSTEM (production, single source of truth) ────\n" + V3_MERGED_PROMPT.slice(0, 500) + "\n…(truncated)…\n");
    console.log(`──── USER (PROD shape — objection NOT handed in) ────\n` + buildUserMessage(SCENARIOS[0], { withAnchors: false, omitObjection: true }));
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
