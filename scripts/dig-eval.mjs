/**
 * dig-eval.mjs — ↓ Dig Deeper card eval (4a.1 single-shot) with an AI judge.
 *
 *   node scripts/dig-eval.mjs            # full run (all fixtures)
 *   LIMIT=5 node scripts/dig-eval.mjs    # first 5 fixtures
 *   ONLY=9 node scripts/dig-eval.mjs     # just fixture #9
 *   REPEAT=3 node scripts/dig-eval.mjs   # run each fixture 3x (catch stochastic blind spots)
 *   DRY=1 node scripts/dig-eval.mjs      # no API calls — prove assembly + report
 *   CROSS=1 node scripts/dig-eval.mjs    # ALSO cross-judge every card with gpt-4o
 *
 * The card must, per fixture:
 *   expect:"question"  → return a non-null QUESTION aimed at the weakest belief (never dig-blind).
 *   expect:"takeClose" → return {belief:null, line:null} (digging a ready prospect is the failure).
 * The judge (blind to expectation) grades tonality, whether it's one clean question, whether it
 * aims at the right belief, fabrication, and order-violations (Money/Support surfaced too early).
 *
 * Sebastian is the FINAL tonality judge — the AI scores are triage/volume.
 * Writes tasks/kb-ab-test/dig-eval-results.md + .json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PROD_DIG_PROMPT, buildDigUserMessage } from "./dig-prompts.mjs";
import { SCENARIOS } from "./dig-eval-corpus.mjs";
import { BELIEF_TAXONOMY } from "../src/lib/wingman/dig-prompt.mjs";

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
const CROSS = !!process.env.CROSS;
const ONLY = process.env.ONLY ? Number(process.env.ONLY) : null;
const REPEAT = process.env.REPEAT ? Math.max(1, Number(process.env.REPEAT)) : 1;
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : SCENARIOS.length;
const DIG_MODEL = process.env.DIG_MODEL || "claude-sonnet-4-6";
const JUDGE_MODEL = process.env.JUDGE_MODEL || "claude-sonnet-4-6";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!DRY && !ANTHROPIC_KEY) { console.error("Missing ANTHROPIC_API_KEY (or run with DRY=1)"); process.exit(1); }
if (CROSS && !OPENAI_KEY) { console.error("CROSS=1 needs OPENAI_API_KEY"); process.exit(1); }

// ── Anthropic call with one retry on overload/rate-limit ─────────────────────
async function anthropic(model, system, user, maxTokens) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 30_000);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
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

// ── OpenAI call (gpt-4o cross-judge) ─────────────────────────────────────────
async function openai(system, user, maxTokens) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 30_000);
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${OPENAI_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", max_tokens: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      signal: controller.signal,
    });
    if (!resp.ok) return { error: `${resp.status}` };
    const text = (await resp.json()).choices?.[0]?.message?.content?.trim() ?? "";
    return { text };
  } catch (e) {
    return { error: e?.name === "AbortError" ? "timeout" : (e?.message || "fetch error") };
  } finally { clearTimeout(t); }
}

function extractJson(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return null;
}

// ── Generate one dig card ────────────────────────────────────────────────────
async function generateCard(scenario) {
  if (DRY) return { belief: scenario.targetBelief ?? "Pain", line: scenario.expect === "takeClose" ? null : `(dry) probing question for #${scenario.id}`, tookClose: scenario.expect === "takeClose" };
  const user = buildDigUserMessage(scenario);
  const { text, error } = await anthropic(DIG_MODEL, PROD_DIG_PROMPT, user, 150);
  if (error) return { line: null, error, tookClose: false };
  const parsed = extractJson(text);
  if (parsed && typeof parsed.line === "string" && parsed.line.trim()) {
    const belief = BELIEF_TAXONOMY.includes(parsed.belief) ? parsed.belief : null;
    return { belief, line: parsed.line.trim(), tookClose: false };
  }
  // {belief:null, line:null} → take the close (deliberate, not a failure)
  if (parsed && parsed.line === null) return { belief: null, line: null, tookClose: true };
  const m = text.match(/"line"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m) return { belief: null, line: m[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim(), tookClose: false };
  return { line: null, error: "unparseable", raw: text.slice(0, 160), tookClose: false };
}

// ── Judge one dig question (blind to the fixture's expectation) ───────────────
const JUDGE_SYSTEM = `You are a strict, fair grader of DISCOVERY QUESTIONS for a live high-ticket sales copilot. The line is what a rep reads ONCE and asks OUT LOUD, in real time, to dig deeper and build a belief. Grade ONLY against the GROUND TRUTH (the live belief-ladder scorecard). You do not know what the system was "supposed" to do — judge the question on its merits.

The 7 beliefs a prospect must hold to buy: Pain, Doubt (can't fix it themselves), Cost (of inaction), Desire, Money, Support (who else decides), Trust (why you). Great digging aims a question at the WEAKEST belief (⚠️ at-risk first, then ⬜ open, then 🟡 partial — see the WEAKEST LINK line), in the prospect's own words, one clean question at a time.

Score these dimensions:
- tonality (0-5): does it sound like a calm, warm, curious elite closer talking? 5 = indistinguishable from a top closer leading discovery. 0 = robotic / formal / reads like AI or an interrogation.
- brevity (0-2): 2 = ~20 words or fewer, one sentence; 1 = a bit long; 0 = a paragraph.
- one_question (0-2): 2 = ONE clean question; 1 = one question but padded; 0 = stacks multiple questions ("and also… what about…").
- is_question (0-2): 2 = a real question the rep asks the prospect; 1 = a statement that clearly invites a response; 0 = an instruction/statement that is not askable.
- right_belief (0-2): 2 = aims squarely at the weakest belief per the WEAKEST LINK line; 1 = a reasonable but not-the-weakest belief; 0 = misreads what's weak.
- no_windup (0-2): 2 = goes straight to the question, OR opens with a natural warm lead-in / permission-ask a real closer uses ("gotcha,", "okay so,", "can I ask you something personal?"); 0 = AI-style wind-up that NAMES what it's about to do ("I'm curious to understand…", "I'd love to explore…"). Warm lead-ins and permission-asks are GOOD — never penalize them.

Some fixtures include a REP'S SALES DNA section: offer context the rep saved BEFORE the call — averages about the TYPICAL prospect for this offer, NOT things this prospect said. Good offer-aware digging uses it to aim (e.g. knowing "quit my job" typically chunks down to a monthly cash-flow number for this offer) — but its facts are NOT ground truth about this prospect.

Hard flags (trust-killers — judge carefully against the ground truth):
- fabrication (true/false): TRUE if the question states ANY specific — a number, quote, name, or fact — NOT supported by the ground truth, or alters/sharpens one (e.g. "so you want to go from $8k to $30k" when those numbers aren't in the memory). A belief marked ⬜ open is UN-discussed — asking about it as if you know details is fabrication. A specific imported from the REP'S SALES DNA and asserted as this prospect's situation ("so you're at around $30k a month, right?") is fabrication — the DNA describes the average prospect, not this one. When in doubt a stated specific is grounded, mark TRUE.
- order_violation (true/false): TRUE if the question digs into MONEY (budget/afford/investment) or SUPPORT (spouse/partner/who decides) while PAIN is still ⬜ open or 🟡 partial AND the call is early (Stage Rapport/Discovery). Cole's doctrine leaves Money and Support for later, after the problem and goal are built. FALSE if Pain is already ✅ locked, or the conversation clearly moved there on its own.

Return ONLY this JSON object, nothing else:
{ "tonality": n, "brevity": n, "one_question": n, "is_question": n, "right_belief": n, "no_windup": n, "fabrication": true|false, "order_violation": true|false, "rationale": "one short sentence" }`;

function judgeUser(scenario, line) {
  // Phase 1b: surface the fixture's Sales DNA to the judge, labeled as rep context —
  // so a question importing a DNA specific as the prospect's own reads as fabrication.
  const dnaSection = scenario.salesDna
    ? `REP'S SALES DNA (offer context the rep saved BEFORE the call — averages about the typical prospect, NOT things this prospect said):\n${JSON.stringify(scenario.salesDna, null, 2)}\n\n`
    : "";
  return dnaSection +
         `GROUND TRUTH — the live belief-ladder scorecard:\n${scenario.context ?? "(no scorecard yet — this is the first ~2 minutes of the call; only the recent transcript is available, so a solid generic OPENING discovery question is correct and fabrication of specifics is especially bad)"}\n\n` +
         `RECENT TRANSCRIPT:\n${scenario.transcript}\n\n` +
         `THE DIG QUESTION TO GRADE: "${line}"`;
}

const ZERO = { tonality: 0, brevity: 0, one_question: 0, is_question: 0, right_belief: 0, no_windup: 0, fabrication: false, order_violation: false, rationale: "" };

function normalizeScore(p) {
  const num = (v, max) => Math.max(0, Math.min(max, Number(v) || 0));
  return {
    tonality: num(p.tonality, 5), brevity: num(p.brevity, 2), one_question: num(p.one_question, 2),
    is_question: num(p.is_question, 2), right_belief: num(p.right_belief, 2), no_windup: num(p.no_windup, 2),
    fabrication: !!p.fabrication, order_violation: !!p.order_violation,
    rationale: String(p.rationale || "").slice(0, 240),
  };
}

async function judgeCard(scenario, line, useOpenAI) {
  if (line == null) return { ...ZERO, rationale: "no question generated", _failed: true };
  if (DRY) return { tonality: 4, brevity: 2, one_question: 2, is_question: 2, right_belief: 2, no_windup: 2, fabrication: false, order_violation: false, rationale: "(dry stub)" };
  const call = useOpenAI ? openai(JUDGE_SYSTEM, judgeUser(scenario, line), 400) : anthropic(JUDGE_MODEL, JUDGE_SYSTEM, judgeUser(scenario, line), 400);
  const { text, error } = await call;
  if (error) return { ...ZERO, rationale: `judge error: ${error}`, _failed: true };
  const p = extractJson(text);
  if (!p) return { ...ZERO, rationale: "judge unparseable", _failed: true };
  return normalizeScore(p);
}

// composite out of 15 (tonality x2). fabrication/order-violation = trust fail → 0 for ranking.
function composite(s) {
  if (s.fabrication || s.order_violation) return 0;
  return s.tonality * 2 + s.brevity + s.one_question + s.is_question + s.right_belief + s.no_windup;
}

async function run() {
  let all = SCENARIOS.slice(0, LIMIT);
  if (ONLY != null) all = SCENARIOS.filter((s) => s.id === ONLY);
  mkdirSync(OUT, { recursive: true });

  console.log(`${DRY ? "[DRY] " : ""}Dig eval — ${all.length} fixtures × ${REPEAT} run(s)${DRY ? " (no API)" : ` — gen=${DIG_MODEL}, judge=${JUDGE_MODEL}${CROSS ? " + gpt-4o cross" : ""}`}\n`);

  const rows = [];
  // deterministic failure tallies
  let falseSilence = 0;   // expected a question, took the close (or errored)
  let wrongDig = 0;       // expected take-close, gave a question
  let fabrications = 0;
  let orderViolations = 0;
  let rightBeliefHits = 0, rightBeliefN = 0;
  let toneSum = 0, toneN = 0;

  for (const s of all) {
    for (let rep = 0; rep < REPEAT; rep++) {
      const card = await generateCard(s);
      const gaveQuestion = card.line != null && !card.tookClose;

      // Deterministic contract check
      let contract = "ok";
      if (s.expect === "question" && !gaveQuestion) { contract = "FALSE-SILENCE"; falseSilence++; }
      if (s.expect === "takeClose" && gaveQuestion) { contract = "WRONG-DIG"; wrongDig++; }

      // Judge only real questions (take-close cards have no line to grade)
      let score = null, crossScore = null;
      if (gaveQuestion) {
        score = await judgeCard(s, card.line, false);
        if (CROSS) crossScore = await judgeCard(s, card.line, true);
        if (score.fabrication) fabrications++;
        if (score.order_violation) orderViolations++;
        toneSum += score.tonality; toneN++;
        if (s.targetBelief) { rightBeliefN++; if (score.right_belief >= 2 || card.belief === s.targetBelief) rightBeliefHits++; }
      }

      rows.push({ id: s.id, label: s.label, expect: s.expect, rep, card, contract, score, crossScore, targetBelief: s.targetBelief });
      const tag = card.tookClose ? "TAKE-CLOSE" : (card.line == null ? `ERR(${card.error})` : `${composite(score)}/15`);
      const flags = score ? [score.fabrication ? "🚨FAB" : "", score.order_violation ? "⚠️ORDER" : "", card.belief && s.targetBelief && card.belief !== s.targetBelief ? `belief:${card.belief}≠${s.targetBelief}` : ""].filter(Boolean).join(" ") : "";
      console.log(`#${String(s.id).padStart(2)}${REPEAT > 1 ? `.${rep}` : ""} [${s.expect === "takeClose" ? "close" : "dig  "}] ${contract === "ok" ? "✓" : "✗ " + contract} ${tag} ${flags}  ${card.line ?? "(took the close)"}`);
    }
  }

  // ── GATE ─────────────────────────────────────────────────────────────────
  const tone = toneN ? toneSum / toneN : 0;
  const rightBeliefRate = rightBeliefN ? rightBeliefHits / rightBeliefN : 1;
  const gA = falseSilence === 0;              // never dig-blind on a real dig moment
  const gB = wrongDig === 0;                  // never dig a ready-to-close prospect
  const gC = fabrications === 0;              // no invented specifics
  const gD = orderViolations === 0;           // no money/spouse while Pain is open early
  const gE = tone >= 4.5;                     // tonality holds
  const gF = rightBeliefRate >= 0.8;          // aims at the right belief ≥80%
  const pass = gA && gB && gC && gD && gE && gF;

  const gateLines = [
    `no false-silence (gave a question when one was needed) ${gA ? "✅" : `❌ (${falseSilence})`}`,
    `no wrong-dig (took the close when ready) ${gB ? "✅" : `❌ (${wrongDig})`}`,
    `zero fabrication ${gC ? "✅" : `❌ (${fabrications})`}`,
    `zero order-violations ${gD ? "✅" : `❌ (${orderViolations})`}`,
    `tonality ≥4.5 ${gE ? "✅" : "❌"} (${tone.toFixed(2)})`,
    `right-belief ≥80% ${gF ? "✅" : "❌"} (${(rightBeliefRate * 100).toFixed(0)}%)`,
  ];

  // ── Report ─────────────────────────────────────────────────────────────────
  const md = [];
  md.push("# Dig Deeper Card Eval — 4a.1 single-shot");
  md.push("");
  md.push(`Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} · ${all.length} fixtures × ${REPEAT} · gen=\`${DIG_MODEL}\` · judge=\`${JUDGE_MODEL}\`${CROSS ? " + gpt-4o cross" : ""}${DRY ? " · **DRY**" : ""}`);
  md.push("> AI judge is triage. **Sebastian is the final tonality judge** — read the questions.");
  md.push("");
  md.push(`## ${pass ? "✅ GATE PASS" : "❌ GATE FAIL"}`);
  md.push("");
  md.push(gateLines.map((l) => `- ${l}`).join("\n"));
  md.push("");
  md.push("## Per-fixture");
  md.push("");
  for (const r of rows) {
    const head = `### #${r.id}${REPEAT > 1 ? `.${r.rep}` : ""} — ${r.label}  _(expect: ${r.expect})_`;
    md.push(head);
    if (r.card.tookClose) {
      md.push(`- ${r.contract === "ok" ? "✅" : "❌ " + r.contract} **TOOK THE CLOSE** (belief:null, line:null)`);
    } else if (r.card.line == null) {
      md.push(`- ❌ ${r.contract} — no card (${r.card.error})`);
    } else {
      const s = r.score;
      const flags = [s.fabrication ? "🚨FAB" : "", s.order_violation ? "⚠️ORDER" : ""].filter(Boolean).join(" ");
      md.push(`- ${r.contract === "ok" ? "✅" : "❌ " + r.contract} (${composite(s)}/15${flags ? " " + flags : ""}) belief=\`${r.card.belief ?? "—"}\`${r.targetBelief ? ` (want ${r.targetBelief})` : ""}: **"${r.card.line}"**`);
      md.push(`  <sub>tone ${s.tonality} · brev ${s.brevity} · 1-q ${s.one_question} · is-q ${s.is_question} · belief ${s.right_belief} · no-windup ${s.no_windup} — ${s.rationale}</sub>`);
      if (r.crossScore) md.push(`  <sub>gpt-4o: tone ${r.crossScore.tonality} · belief ${r.crossScore.right_belief} · fab ${r.crossScore.fabrication} · order ${r.crossScore.order_violation} — ${r.crossScore.rationale}</sub>`);
    }
    md.push("");
  }

  writeFileSync(join(OUT, "dig-eval-results.md"), md.join("\n"));
  writeFileSync(join(OUT, "dig-eval-results.json"), JSON.stringify({ meta: { date: new Date().toISOString(), digModel: DIG_MODEL, judgeModel: JUDGE_MODEL, cross: CROSS, repeat: REPEAT, n: all.length }, gate: { pass, gA, gB, gC, gD, gE, gF, tone, rightBeliefRate, falseSilence, wrongDig, fabrications, orderViolations }, rows }, null, 2));

  console.log("\n── GATE ──");
  console.log(`${pass ? "✅ PASS" : "❌ FAIL"}\n` + gateLines.map((l) => "  " + l).join("\n"));
  console.log(`\nWrote tasks/kb-ab-test/dig-eval-results.md (+ .json)`);
  if (!pass && !DRY) process.exitCode = 1;
}

run().catch((e) => { console.error(e); process.exit(1); });
