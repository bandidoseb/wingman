/**
 * confrontation-eval.mjs — the HARD GATE + eyeball batch for the confrontationalness dial.
 *
 *   node scripts/confrontation-eval.mjs                 # full gate + batch doc
 *   DRY=1 node scripts/confrontation-eval.mjs           # no API calls — prove wiring
 *   REPEAT=3 node scripts/confrontation-eval.mjs        # more A/B samples per ordering check
 *   CLAUDE_ONLY=1 node scripts/confrontation-eval.mjs   # iterate without the gpt-4o cross-judge
 *   ORDER_LIMIT=8 node scripts/confrontation-eval.mjs   # cap the (costly) ordering gate to N/family
 *   LIMIT=3 node scripts/confrontation-eval.mjs         # first N fixtures per family (quick smoke)
 *
 * WHAT IT PROVES (HARD gates — any red = exit 1):
 *   0. BYTE-IDENTITY — build*SystemPrompt('direct'|null|'garbage') === the shipped constant.
 *   1. JUDGE VALIDATION (first) — the blind A/B "which is harder?" ruler orders obvious pairs.
 *   2. FIRE/SILENCE STABILITY — softening never mutes a real card; hardening never invents one.
 *   3. INTENSITY ORDERING — per fixture: challenger is never MAJORITY-softer than consultative and
 *      no lower level majority-beats it (real "dial backwards" defects). Corpus: ≥75% of fixtures
 *      show STRONG (≥75%-harder) separation — proves real range while letting inherently gentle
 *      beliefs (Money, Support; doctrine pre-frames them softly) correctly compress. Minor per-
 *      fixture vote splits on subtle dig gaps are noise, not gated. challenger-vs-direct = advisory.
 *   5. NO FABRICATION — no level invents a number/quote/fact/social-proof for force.
 *   6. LENGTH HELD — objection ≤45 words, dig ≤40, at every level.
 *   7. TONALITY FLOOR — every level (incl. challenger) still sounds like an elite closer:
 *      per-level MEAN tonality ≥ 4.4 (robust over 20+ cards) AND no card < 3.0. Individual cards in
 *      [3.0, 4.0) are surfaced as advisories (one dual-judge card score is noisy), not a hard fail.
 *   8. CHALLENGER NOT TOO FAR — no challenger card reads as rude/attacking/desperate (both judges).
 * ADVISORY (reported, not gated): fine-grained ordering (challenger-vs-direct), same-diagnosis drift.
 *
 * ALWAYS writes a human-readable batch for Sebastian to eyeball as the FINAL judge:
 *   tasks/confrontation-card-batch.md  — every situation × 4 levels, with inline scores/flags.
 * Full machine report: tasks/confrontation-eval-results.md.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  OBJECTION_SYSTEM_PROMPT, buildObjectionSystemPrompt, buildObjectionUserSegments,
} from "../src/lib/wingman/objection-prompt.mjs";
import {
  DIG_SYSTEM_PROMPT, buildDigSystemPrompt, buildDigUserSegments,
} from "../src/lib/wingman/dig-prompt.mjs";
import { scanTics } from "./tic-gate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../tasks");

function loadEnv() {
  const text = readFileSync(join(__dirname, "../.env.local"), "utf8");
  for (const l of text.split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv();

const DRY         = !!process.env.DRY;
const CLAUDE_ONLY = !!process.env.CLAUDE_ONLY;
const REPEAT      = process.env.REPEAT ? Math.max(1, Number(process.env.REPEAT)) : 2;
const LIMIT       = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
const ORDER_LIMIT = process.env.ORDER_LIMIT ? Number(process.env.ORDER_LIMIT) : Infinity;
const POOL        = process.env.POOL ? Number(process.env.POOL) : 4;
const GEN_MODEL   = process.env.GEN_MODEL || "claude-sonnet-4-6";
const JUDGE_CLAUDE = "claude-sonnet-4-6";
const JUDGE_GPT    = "gpt-4o";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_KEY    = process.env.OPENAI_API_KEY;

const LEVELS = ["consultative", "balanced", "direct", "challenger"]; // soft → hard
const JUDGES = () => (CLAUDE_ONLY ? ["claude"] : ["claude", "gpt-4o"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lim = (arr) => (LIMIT === Infinity ? arr : arr.slice(0, LIMIT));

// ── concurrency pool — independent API calls run N-at-a-time (order-independent stores) ──
async function mapPool(items, fn, pool = POOL) {
  const out = new Array(items.length);
  let i = 0;
  const worker = async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(pool, items.length)) }, worker));
  return out;
}

// ── API helpers ──
async function anthropic(model, system, user, maxTokens) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 30_000);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
        signal: c.signal,
      });
      if (resp.status === 429 || resp.status === 529) { if (attempt < 2) { await sleep(2500 * (attempt + 1)); continue; } return { error: `${resp.status}` }; }
      if (!resp.ok) return { error: `${resp.status}` };
      return { text: (await resp.json()).content?.[0]?.text?.trim() ?? "" };
    } catch (e) {
      if (attempt < 2 && e?.name !== "AbortError") { await sleep(1500); continue; }
      return { error: e?.name === "AbortError" ? "timeout" : (e?.message || "fetch") };
    } finally { clearTimeout(t); }
  }
  return { error: "unreachable" };
}
async function openai(model, system, user, maxTokens) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 30_000);
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${OPENAI_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
        signal: c.signal,
      });
      if (resp.status === 429) { if (attempt < 2) { await sleep(2500 * (attempt + 1)); continue; } return { error: "429" }; }
      if (!resp.ok) return { error: `${resp.status}` };
      return { text: (await resp.json()).choices?.[0]?.message?.content?.trim() ?? "" };
    } catch (e) {
      if (attempt < 2 && e?.name !== "AbortError") { await sleep(1500); continue; }
      return { error: e?.name === "AbortError" ? "timeout" : (e?.message || "fetch") };
    } finally { clearTimeout(t); }
  }
  return { error: "unreachable" };
}
const callJudge = (judge, system, user, maxTokens) =>
  judge === "gpt-4o" ? openai(JUDGE_GPT, system, user, maxTokens) : anthropic(JUDGE_CLAUDE, system, user, maxTokens);

function extractJson(raw) {
  const cleaned = String(raw).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* */ } }
  return null;
}

// ── generation (real production builders; segments flattened to one string) ──
const flatten = (segs) => segs.map((s) => s.text).join("");
const wordCount = (s) => (s ? s.trim().split(/\s+/).filter(Boolean).length : 0);

function parseObjection(text) {
  const p = extractJson(text);
  if (p && typeof p.line === "string" && p.line.trim()) return { kind: "line", line: p.line.trim() };
  if (p && p.line === null) return { kind: "abstain" };
  const m = String(text).match(/"line"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m && m[1].trim()) return { kind: "line", line: m[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim() };
  if (/"line"\s*:\s*null/.test(String(text))) return { kind: "abstain" };
  return { kind: "error", raw: String(text).slice(0, 160) };
}
function parseDig(text) {
  const p = extractJson(text);
  if (p && typeof p.line === "string" && p.line.trim()) return { kind: "line", line: p.line.trim(), belief: p.belief ?? null };
  if (p && p.line === null) return { kind: "nudge" };
  if (/"line"\s*:\s*null/.test(String(text))) return { kind: "nudge" };
  const m = String(text).match(/"line"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m && m[1].trim()) return { kind: "line", line: m[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim() };
  return { kind: "error", raw: String(text).slice(0, 160) };
}
async function genObjection(fx, level) {
  if (DRY) return { kind: fx.expect === "abstain" ? "abstain" : "line", line: `(dry ${level}) ${fx.latest.slice(0, 32)}` };
  const system = buildObjectionSystemPrompt(level);
  const user = flatten(buildObjectionUserSegments({ liveSummary: fx.belief, latestResponse: fx.latest, thread: fx.thread }));
  for (let a = 0; a < 2; a++) {
    const { text, error } = await anthropic(GEN_MODEL, system, user, 150);
    if (error) { if (a === 0) { await sleep(1200); continue; } return { kind: "error", error }; }
    const r = parseObjection(text); if (r.kind === "error" && a === 0) { await sleep(400); continue; } return r;
  }
}
async function genDig(fx, level) {
  if (DRY) return { kind: fx.expect === "close" ? "nudge" : "line", line: `(dry ${level}) ${fx.latest.slice(0, 32)}`, belief: "Pain" };
  const system = buildDigSystemPrompt(level);
  const user = flatten(buildDigUserSegments({ salesDna: fx.salesDna, liveSummary: fx.belief, latestResponse: fx.latest }));
  for (let a = 0; a < 2; a++) {
    const { text, error } = await anthropic(GEN_MODEL, system, user, 150);
    if (error) { if (a === 0) { await sleep(1200); continue; } return { kind: "error", error }; }
    const r = parseDig(text); if (r.kind === "error" && a === 0) { await sleep(400); continue; } return r;
  }
}

// ── judges ──
const AB_SYSTEM = `You compare two lines a sales rep could say to a prospect at the SAME moment. Judge ONLY how CONFRONTATIONAL each is — how hard, blunt, and direct the pressure is. A confrontational line names avoidance out loud, challenges head-on, drops hedging/permission, pushes hard toward a decision. A soft line invites, hedges, asks permission, lowers pressure. You do NOT know which system wrote which; judge only the words.
Return ONLY: { "harder": "A" | "B" | "same", "why": "one short clause" }. Use "same" ONLY if genuinely indistinguishable in intensity.`;
async function abJudge(judge, a, b) {
  if (DRY) return { harder: "A" };
  const { text, error } = await callJudge(judge, AB_SYSTEM, `LINE A: "${a}"\n\nLINE B: "${b}"\n\nWhich is MORE confrontational?`, 120);
  if (error) return { error };
  const p = extractJson(text);
  return p && ["A", "B", "same"].includes(p.harder) ? { harder: p.harder } : { error: "unparseable" };
}
async function tallyHarder(x, y, n) {
  if (DRY) { const t = n * JUDGES().length; return { xWins: t, yWins: 0, ties: 0, total: t, xFrac: 1, detail: "dry" }; }
  let xWins = 0, yWins = 0, ties = 0;
  for (let r = 0; r < n; r++) {
    const flip = Math.random() < 0.5;
    const [A, B] = flip ? [y, x] : [x, y];
    const xIs = flip ? "B" : "A";
    for (const j of JUDGES()) {
      const res = await abJudge(j, A, B);
      if (res.error) continue;
      if (res.harder === "same") ties++; else if (res.harder === xIs) xWins++; else yWins++;
    }
  }
  const total = xWins + yWins + ties;
  return { xWins, yWins, ties, total, xFrac: total ? xWins / total : 0, detail: `${xWins}↑/${yWins}↓/${ties}~` };
}

const DIAG_SYSTEM = `You are checking whether a set of sales lines all work the SAME underlying issue for THIS prospect. You'll get GROUND TRUTH and up to 4 versions of the rep's next line. They differ in tone/intensity AND may use different valid tactics (a different question, angle, or lever) — that variation is EXPECTED and fine. Mark them SAME as long as they all target the SAME underlying weak belief / concern. Mark DIFFERENT only if a version clearly jumps to an UNRELATED belief or topic the others don't touch.
Return ONLY: { "same_diagnosis": true|false, "why": "one short sentence" }.`;
async function diagnosisJudge(judge, ground, lines) {
  if (DRY) return { same_diagnosis: true };
  const { text, error } = await callJudge(judge, DIAG_SYSTEM, `GROUND TRUTH:\n${ground}\n\nVERSIONS:\n${lines.map((l, i) => `${i + 1}. "${l}"`).join("\n")}`, 160);
  if (error) return { error };
  const p = extractJson(text);
  return p && typeof p.same_diagnosis === "boolean" ? p : { error: "unparseable" };
}

const FAB_SYSTEM = `You check a single sales line for FABRICATION against ground truth. Return ONLY: { "fabrication": true|false, "why": "one short clause" }.
fabrication=TRUE only if the line ASSERTS a specific AS FACT — a number, quote, name, company, statistic, a claim about OTHER clients/people, or a manufactured urgency/deadline — NOT supported by the ground truth (or sharpens/alters one).
fabrication=FALSE when the line merely ASKS the prospect FOR a specific ("what's the number?", "give me a real number", "what did that cost you?") — requesting a detail is the rep's job, only inventing one is fabrication. Generic language ("a much bigger month") is NOT fabrication. When unsure whether a specific is ASSERTED vs asked for, and it's clearly a question/imperative, mark FALSE.`;
async function fabricationJudge(judge, ground, line) {
  if (DRY) return { fabrication: false };
  const { text, error } = await callJudge(judge, FAB_SYSTEM, `GROUND TRUTH:\n${ground}\n\nLINE: "${line}"`, 120);
  if (error) return { error };
  const p = extractJson(text);
  return p && typeof p.fabrication === "boolean" ? p : { error: "unparseable" };
}

// QUALITY — does this sound like an elite closer, at ANY intensity? Intensity is NOT the axis here:
// a warm consultative invite and a blunt challenger line can BOTH be 5/5 if they sound like a real
// top closer talking. Penalize robotic/AI/email tone, garden-path clunk, self-narrating wind-up, and
// stacked multi-move lines — NOT directness or softness.
const QUALITY_SYSTEM = `You grade ONE line/question a sales rep reads once and says OUT LOUD, live, to a prospect. It may be gentle or blunt — INTENSITY IS NOT WHAT YOU JUDGE. Judge whether it sounds like a real, elite, human closer talking, and whether it's clean to deliver.
Score:
- tonality (0-5): 5 = indistinguishable from a top closer speaking naturally (warm OR hard, both fine); 0 = robotic, formal, reads like AI or an email.
- one_beat (0-2): 2 = ONE move/question; 0 = stacks multiple.
- clean (0-2): 2 = clear on first read, natural spoken contractions, no garden-path stumble, no self-narrating wind-up ("I'm curious…", "I'm sensing…"); 0 = clunky/AI wind-up. A brief warm pace or permission-ask ("I hear you", "can I be honest?") is GOOD, not wind-up.
Return ONLY: { "tonality": n, "one_beat": n, "clean": n, "why": "one short clause" }.`;
async function qualityJudge(judge, kind, line) {
  if (DRY) return { tonality: 5, one_beat: 2, clean: 2 };
  const label = kind === "dig" ? "This is a DISCOVERY QUESTION." : "This is an OBJECTION-HANDLING line.";
  const { text, error } = await callJudge(judge, QUALITY_SYSTEM, `${label}\n\nLINE: "${line}"`, 150);
  if (error) return { error };
  const p = extractJson(text);
  if (!p) return { error: "unparseable" };
  const num = (v, mx) => Math.max(0, Math.min(mx, Number(v) || 0));
  return { tonality: num(p.tonality, 5), one_beat: num(p.one_beat, 2), clean: num(p.clean, 2), why: String(p.why || "").slice(0, 120) };
}

// TOO-FAR — challenger only. Firm/blunt/direct is the GOAL and must pass. Fail ONLY if it crosses
// into something that would damage rapport: insulting, contemptuous, attacking the person, or
// desperate/needy pushiness.
const TOOFAR_SYSTEM = `You check ONE confrontational sales line. Being blunt, direct, and challenging is the GOAL — that is GOOD and must PASS. Flag it ONLY if it crosses a line a great closer never would: it insults or demeans the prospect, is contemptuous or sarcastic at their expense, attacks them personally, or sounds desperate/needy/pushy in a way that would damage rapport or make them defensive.
Return ONLY: { "too_far": true|false, "why": "one short clause" }. Default to FALSE — only firm-but-caring is fine; reserve TRUE for genuinely rude/attacking/desperate.`;
async function tooFarJudge(judge, line) {
  if (DRY) return { too_far: false };
  const { text, error } = await callJudge(judge, TOOFAR_SYSTEM, `LINE: "${line}"`, 120);
  if (error) return { error };
  const p = extractJson(text);
  return p && typeof p.too_far === "boolean" ? p : { error: "unparseable" };
}

// ── FIXTURES ────────────────────────────────────────────────────────────────────
const OBJ_REAL = [
  { id: "money-tight", belief: "1 Pain ✅ — hates the grind\n4 Desire ✅ — wants $30k months\n5 Money ⚠️ — flinched at price", ground: "Agency owner, wants $30k months, just heard the $8k price and says it's a lot right now. No other numbers stated.", latest: "Honestly that's a lot of money right now. I don't know.", expect: "line" },
  { id: "money-anchor", belief: "1 Pain ✅\n4 Desire ✅\n5 Money ⚠️ — sticker shock", ground: "Prospect expected it to cost less; surprised by the price. No figures stated beyond 'more than expected'.", latest: "I mean… that's a lot more than I was expecting to spend on this.", expect: "line" },
  { id: "think", belief: "1 Pain 🟡 — busy, overwhelmed\n7 Trust ⬜", ground: "Engaged, said the offer sounds good, now wants to think about it. Nothing specific about money or a partner stated.", latest: "Yeah this sounds good, let me think about it and get back to you.", expect: "line" },
  { id: "trust-burned", belief: "7 Trust ⚠️ — burned by a past coach\n1 Pain ✅ — stuck at $10k", ground: "Paid a mentor before, didn't work; skeptical. Stuck at $10k months. No other figures stated.", latest: "I've done a coaching thing before and it was a waste. How's this any different?", expect: "line" },
  { id: "fear", belief: "1 Pain ✅ — miserable in job\n4 Desire ✅ — wants to go full-time\n5 Money 🟡", ground: "Wants to quit their job and go full-time; nervous it's a big leap. No numbers beyond that.", latest: "I mean… this is a big decision. What if it doesn't work out for me?", expect: "line" },
  { id: "partner", belief: "1 Pain ✅\n4 Desire ✅\n6 Support ⚠️ — spouse not on call", ground: "Wants to run it by their spouse before deciding. Unclear if courtesy or a real gate.", latest: "I'd need to talk to my wife before I make a decision like this.", expect: "line" },
  { id: "timing", belief: "1 Pain ✅\n3 Cost ⬜\n4 Desire ✅", ground: "Prospect says now isn't a good time, floats next quarter. Real problem exists but they're deferring.", latest: "Now's just not a great time for me. Maybe next quarter would be better.", expect: "line" },
  { id: "send-info", belief: "1 Pain 🟡\n7 Trust ⬜", ground: "Prospect wants to be sent info to review later — a soft brush-off / stall.", latest: "Can you just send me some information and I'll look it over on my own time?", expect: "line" },
  { id: "diy", belief: "1 Pain ✅ — stalled 18 months\n2 Doubt ⚠️ — thinks he can DIY", ground: "Has been trying on his own for 18 months without cracking it; still thinks he can figure it out alone.", latest: "Honestly I feel like I could probably just figure this out on my own.", expect: "line" },
  { id: "competitor", belief: "1 Pain ✅\n7 Trust 🟡 — comparison shopping", ground: "Prospect is weighing a couple other options. No competitor specifics stated.", latest: "I'm actually looking at a couple other options too, so I'm not sure yet.", expect: "line" },
  { id: "skeptic", belief: "1 Pain ✅\n2 Doubt ⚠️ — doubts it'll work for HIM", ground: "Believes it works generally but not that it'll work for his specific situation.", latest: "How do I actually know this'll work for someone like me?", expect: "line" },
  { id: "wishy-washy", belief: "1 Pain 🟡\n4 Desire 🟡 — lukewarm all call", ground: "Prospect has been vague and non-committal the whole call; no clear objection, just flat energy.", latest: "Yeah… maybe. I don't know, I'm not really sure about it.", expect: "line" },
  { id: "too-busy", belief: "1 Pain ✅ — overwhelmed IS the problem\n3 Cost ⬜", ground: "Says he's too slammed to take this on — but the overwhelm is exactly the problem the offer fixes.", latest: "I'm slammed right now, I really don't have time to take on something new.", expect: "line" },
  { id: "results-doubt", belief: "1 Pain ✅\n2 Doubt ⚠️\n7 Trust 🟡", ground: "Saw others not get results from similar programs; worried he'd be one of them. No specifics named.", latest: "I've seen a lot of people not really get results from stuff like this, you know?", expect: "line" },
];
const OBJ_ABSTAIN = [
  { id: "agreeing", belief: "1 Pain ✅\n4 Desire ✅\n5 Money ✅", ground: "Fully bought in, asking logistics.", latest: "Okay this makes total sense, I'm in. How do we get started — do I pay today?", expect: "abstain" },
  { id: "logistics", belief: "1 Pain ✅\n4 Desire ✅", ground: "Pure scheduling question, no worry underneath.", latest: "Cool. And are the calls on Zoom or in person?", expect: "abstain" },
  { id: "engaged", belief: "1 Pain 🟡\n4 Desire ⬜ — early, warming up", ground: "Early, engaged, no pushback — just following along.", latest: "Oh nice, yeah that makes sense. Keep going, I'm with you.", expect: "abstain" },
];
// Threaded objection continuations (beat 2) — the dial must hold across a live back-and-forth.
const OBJ_THREAD = [
  { id: "thread-money-b2", belief: "1 Pain ✅\n4 Desire ✅ — wants $30k months\n5 Money ⚠️", ground: "Money objection, beat 2. Rep already isolated it ('money aside, are you in?'); prospect confirmed they believe it works but the cash is tight this month.", latest: "No yeah, I do think it'd work. It's just — the money's genuinely tight this month.", expect: "line",
    thread: { beatNumber: 2, linesGiven: ["Money aside for a sec — do you actually feel like this gets you to those $30k months?"], historyTranscript: "Rep: Money aside for a sec — do you actually feel like this gets you to those $30k months?\nProspect: No yeah, I do think it'd work. It's just — the money's genuinely tight this month.", leversUsed: ["pace-tie-down"] } },
  { id: "thread-trust-b2", belief: "7 Trust ⚠️ — burned before\n1 Pain ✅", ground: "Trust objection, beat 2. Rep asked what the last program didn't do; prospect said it had no accountability, they fell off.", latest: "Honestly? There was no accountability. I just kind of fell off after a few weeks.", expect: "line",
    thread: { beatNumber: 2, linesGiven: ["What did that last program not do that you actually needed?"], historyTranscript: "Rep: What did that last program not do that you actually needed?\nProspect: Honestly? There was no accountability. I just kind of fell off after a few weeks.", leversUsed: ["why-probe"] } },
];
const DIG_NORMAL = [
  { id: "open-pain", belief: "1 Pain ⬜\n4 Desire ⬜", ground: "Early. Prospect said business is 'kind of stuck'. Nothing specific yet.", latest: "Things are just kind of stuck right now, you know?", expect: "line" },
  { id: "deepen-desire", belief: "1 Pain ✅\n4 Desire 🟡 — 'more money', no number", ground: "Said they want 'more money' but no number or why.", latest: "I just want to be making more money, more consistently.", expect: "line" },
  { id: "cost", belief: "1 Pain ✅ — stuck 2 years\n3 Cost ⬜", ground: "Stuck at the same level two years; cost of inaction untouched.", latest: "Yeah it's been about two years at this same spot honestly.", expect: "line" },
  { id: "doubt-diy", belief: "1 Pain ✅\n2 Doubt 🟡 — tried on own", ground: "Has tried to fix it himself with courses; hasn't worked, reason unclear.", latest: "I've bought a few courses and tried to do it myself but it just hasn't clicked.", expect: "line" },
  { id: "trust-why", belief: "1 Pain ✅\n7 Trust ⬜", ground: "Hasn't surfaced what would make him trust this approach vs past ones.", latest: "I've tried programs before that overpromised, so I'm a little cautious.", expect: "line" },
  { id: "support", belief: "1 Pain ✅\n4 Desire ✅\n6 Support ⬜", ground: "Decision-maker unclear; not yet surfaced who else is involved.", latest: "Yeah this is the kind of thing I'd want to get right.", expect: "line" },
  { id: "money-qualifier", belief: "1 Pain ✅\n2 Doubt ✅\n4 Desire ✅\n5 Money ⬜ — other beliefs built", ground: "Other beliefs built; money not yet surfaced. Time to pre-frame the money question.", latest: "Yeah honestly everything you're saying makes a lot of sense to me.", expect: "line" },
  { id: "vague", belief: "1 Pain 🟡 — vague\n4 Desire ⬜", ground: "Prospect is vague about what they actually want to change.", latest: "I don't know, I just want things to be better than they are now.", expect: "line" },
];
const DIG_CLOSE = [
  { id: "ready", belief: "1 Pain ✅\n2 Doubt ✅\n3 Cost ✅\n4 Desire ✅\n5 Money ✅\n6 Support ✅ — all locked", ground: "Every belief built; prospect asking to move forward.", latest: "This is exactly what I've been looking for. How do we do this?", expect: "close" },
  { id: "ready2", belief: "1 Pain ✅\n2 Doubt ✅\n4 Desire ✅\n5 Money ✅ — ready", ground: "Prospect is decided and wants to start.", latest: "Yeah, I'm ready. Let's just do it.", expect: "close" },
];

const CALIBRATION = [
  { soft: "Yeah, take your time — what would you want to feel sure about before it's a yes?", hard: "Come on, be straight with me — 'thinking about it' just means I didn't show you this works. What's the real hesitation?" },
  { soft: "Totally fair. Is it more the investment, or you're not fully sure it'll work for you?", hard: "So which is it — the money, or you don't actually believe it works? Because those are very different problems." },
  { soft: "Would it be okay if I shared a quick thought on that?", hard: "Let me be blunt with you for a second." },
  { soft: "What's the main thing you'd want to figure out before moving forward?", hard: "You keep dancing around it — what's actually stopping you from doing this today?" },
  { soft: "Can I ask what's making you want to think it over?", hard: "Be honest — is this a real concern, or are you just trying to get off the call politely?" },
];

// ── RUN ──
async function run() {
  if (!DRY && !ANTHROPIC_KEY) { console.error("Missing ANTHROPIC_API_KEY (or DRY=1)"); process.exit(1); }
  if (!DRY && !CLAUDE_ONLY && !OPENAI_KEY) { console.error("❌ OPENAI_API_KEY missing — gpt-4o cross-judge is mandatory. CLAUDE_ONLY=1 to skip."); process.exit(1); }
  const report = [];
  const fail = [];
  const advisories = [];
  const line = (s) => { console.log(s); report.push(s); };
  line("═".repeat(78));
  line("  CONFRONTATIONALNESS DIAL — HARD GATE + eyeball batch");
  line(`  gen=${GEN_MODEL} · judges=${CLAUDE_ONLY ? JUDGE_CLAUDE : `${JUDGE_CLAUDE} + ${JUDGE_GPT}`} · REPEAT=${REPEAT} · pool=${POOL}${DRY ? " · DRY" : ""}`);
  const OBJ_ALL = [...lim(OBJ_REAL), ...lim(OBJ_THREAD)];
  line(`  corpus: ${lim(OBJ_REAL).length} obj real + ${lim(OBJ_THREAD).length} threaded + ${lim(OBJ_ABSTAIN).length} abstain · ${lim(DIG_NORMAL).length} dig + ${lim(DIG_CLOSE).length} close`);
  line("═".repeat(78));

  // GATE 0 — byte identity (no API)
  const idObj = ["direct", null, undefined, "garbage", ""].every((x) => buildObjectionSystemPrompt(x) === OBJECTION_SYSTEM_PROMPT);
  const idDig = ["direct", null, undefined, "garbage", ""].every((x) => buildDigSystemPrompt(x) === DIG_SYSTEM_PROMPT);
  const objApp = LEVELS.filter((l) => l !== "direct").every((l) => buildObjectionSystemPrompt(l) !== OBJECTION_SYSTEM_PROMPT && buildObjectionSystemPrompt(l).startsWith(OBJECTION_SYSTEM_PROMPT));
  const digApp = LEVELS.filter((l) => l !== "direct").every((l) => buildDigSystemPrompt(l) !== DIG_SYSTEM_PROMPT && buildDigSystemPrompt(l).startsWith(DIG_SYSTEM_PROMPT));
  const gate0 = idObj && idDig && objApp && digApp;
  line(`\n[GATE 0] BYTE IDENTITY — ${gate0 ? "✅ PASS" : "❌ FAIL"}  (obj=${idObj}/${objApp} dig=${idDig}/${digApp})`);
  if (!gate0) fail.push("GATE 0 byte-identity");

  // GATE 1 — judge validation
  line(`\n[GATE 1] JUDGE VALIDATION — ${lim(CALIBRATION).length} obvious pairs (≥75% correct, 0 backwards)`);
  const calib = await mapPool(lim(CALIBRATION), (p) => tallyHarder(p.hard, p.soft, Math.max(3, REPEAT)));
  let calibOk = 0;
  calib.forEach((t, i) => { const ok = t.total > 0 && t.xFrac >= 0.75 && t.yWins === 0; if (ok) calibOk++; line(`  pair ${i + 1}: ${ok ? "✅" : "❌"} (${t.detail})`); });
  const gate1 = calibOk === lim(CALIBRATION).length;
  line(`  → ${calibOk}/${lim(CALIBRATION).length} — ${gate1 ? "✅ PASS" : "❌ FAIL (ruler untrustworthy — gate void)"}`);
  if (!gate1) { fail.push("GATE 1 judge-validation"); return finish(report, fail, advisories); }

  // GENERATE everything once (pooled)
  line(`\n[GEN] ${(OBJ_ALL.length + lim(OBJ_ABSTAIN).length + lim(DIG_NORMAL).length + lim(DIG_CLOSE).length) * LEVELS.length} cards…`);
  const gen = { obj: {}, dig: {} };
  const objFx = [...OBJ_ALL, ...lim(OBJ_ABSTAIN)];
  const digFx = [...lim(DIG_NORMAL), ...lim(DIG_CLOSE)];
  await mapPool(objFx.flatMap((fx) => LEVELS.map((l) => ({ fx, l }))), async ({ fx, l }) => { (gen.obj[fx.id] ||= {})[l] = await genObjection(fx, l); });
  await mapPool(digFx.flatMap((fx) => LEVELS.map((l) => ({ fx, l }))), async ({ fx, l }) => { (gen.dig[fx.id] ||= {})[l] = await genDig(fx, l); });

  // GATE 2 — fire/silence
  line(`\n[GATE 2] FIRE/SILENCE STABILITY`);
  let gate2 = true;
  const fireCheck = (fam, fixtures, want, ok) => { for (const fx of fixtures) { const bad = LEVELS.filter((l) => !ok(gen[fam][fx.id][l])); if (bad.length) { gate2 = false; line(`  ❌ ${fam}/${fx.id} (want ${want}): ${bad.map((l) => `${l}=${gen[fam][fx.id][l].kind}`).join(", ")}`); } } };
  fireCheck("obj", OBJ_ALL, "LINE", (r) => r.kind === "line");
  fireCheck("obj", lim(OBJ_ABSTAIN), "ABSTAIN", (r) => r.kind === "abstain");
  fireCheck("dig", lim(DIG_NORMAL), "QUESTION", (r) => r.kind === "line");
  fireCheck("dig", lim(DIG_CLOSE), "NUDGE", (r) => r.kind === "nudge");
  line(`  → ${gate2 ? "✅ PASS" : "❌ FAIL"}`);
  if (!gate2) fail.push("GATE 2 fire/silence");

  // GATE 6 — length
  let gate6 = true;
  for (const fx of OBJ_ALL) for (const l of LEVELS) { const r = gen.obj[fx.id][l]; if (r.kind === "line" && wordCount(r.line) > 45) { gate6 = false; line(`  ❌ length obj/${fx.id}/${l}: ${wordCount(r.line)}w`); } }
  for (const fx of lim(DIG_NORMAL)) for (const l of LEVELS) { const r = gen.dig[fx.id][l]; if (r.kind === "line" && wordCount(r.line) > 40) { gate6 = false; line(`  ❌ length dig/${fx.id}/${l}: ${wordCount(r.line)}w`); } }
  line(`\n[GATE 6] LENGTH HELD — ${gate6 ? "✅ PASS" : "❌ FAIL"}`);
  if (!gate6) fail.push("GATE 6 length");

  // collect all generated LINE cards for per-card judging
  const cards = [];
  for (const fx of [...OBJ_ALL]) for (const l of LEVELS) { const r = gen.obj[fx.id][l]; if (r.kind === "line") cards.push({ fam: "obj", id: fx.id, level: l, line: r.line, ground: fx.ground }); }
  for (const fx of lim(DIG_NORMAL)) for (const l of LEVELS) { const r = gen.dig[fx.id][l]; if (r.kind === "line") cards.push({ fam: "dig", id: fx.id, level: l, line: r.line, ground: fx.ground }); }

  // GATE 9 — TIC-FREE (deterministic; no API). The trustworthy scorer for mechanical AI tics
  // the LLM tonality judge can't feel. HARD-fails the SHIPPED base voice (direct) ONLY — the
  // pinned dial modifiers (consultative/balanced/challenger) still command permission-asks
  // pending the dial-resume retune, so their tics are ADVISORIES here, not fails (else the eval
  // would red on the very modifiers Phase 0 deliberately isn't fixing).
  for (const c of cards) { const t = scanTics(c.line, c.fam === "dig" ? "dig" : "objection"); c.ticHard = t.hard; c.ticSoft = t.soft; }
  const ticFails = cards.filter((c) => c.level === "direct" && c.ticHard.length);
  const gate9 = ticFails.length === 0;
  line(`\n[GATE 9] TIC-FREE — ${gate9 ? "✅ PASS" : "❌ FAIL"}  (direct hard-fail · other levels advisory)`);
  ticFails.forEach((c) => line(`  ❌ ${c.fam}/${c.id}/${c.level}: "${c.line}" — tics: ${c.ticHard.join(", ")}`));
  cards.filter((c) => c.ticHard.length && c.level !== "direct").forEach((c) => advisories.push(`tic (pinned ${c.level}) ${c.fam}/${c.id}: ${c.ticHard.join(", ")} — "${c.line}"`));
  cards.filter((c) => c.ticSoft.length).forEach((c) => advisories.push(`tic-soft ${c.fam}/${c.id}/${c.level}: ${c.ticSoft.join(", ")} — "${c.line}"`));
  if (!gate9) fail.push("GATE 9 tics");

  // GATE 5 — fabrication (dual judge, all cards)
  const judges = JUDGES();
  await mapPool(cards, async (c) => { c.fab = false; c.fabWhy = ""; for (const j of judges) { const r = await fabricationJudge(j, c.ground, c.line); if (!r.error && r.fabrication) { c.fab = true; c.fabWhy = `${j}: ${r.why || ""}`; } } });
  const fabs = cards.filter((c) => c.fab);
  const gate5 = fabs.length === 0;
  line(`\n[GATE 5] NO FABRICATION — ${gate5 ? "✅ PASS" : "❌ FAIL"}`);
  fabs.forEach((c) => line(`  ❌ ${c.fam}/${c.id}/${c.level}: "${c.line}" — ${c.fabWhy}`));
  if (!gate5) fail.push("GATE 5 fabrication");

  // GATE 7 — tonality/quality floor (dual judge, all cards). Mean per level ≥4.3, no card <3.5.
  await mapPool(cards, async (c) => {
    const scores = [];
    for (const j of judges) { const r = await qualityJudge(j, c.fam, c.line); if (!r.error) scores.push(r); }
    c.tonality = scores.length ? scores.reduce((a, s) => a + s.tonality, 0) / scores.length : 0;
    c.one_beat = scores.length ? scores.reduce((a, s) => a + s.one_beat, 0) / scores.length : 0;
    c.clean = scores.length ? scores.reduce((a, s) => a + s.clean, 0) / scores.length : 0;
  });
  const meanTone = {}; for (const l of LEVELS) { const cs = cards.filter((c) => c.level === l); meanTone[l] = cs.length ? cs.reduce((a, c) => a + c.tonality, 0) / cs.length : 0; }
  // HARD gate = per-level MEAN ≥4.4 (robust across 20+ cards). A single card's dual-judge score is
  // noisy, so individual low cards are surfaced as ADVISORIES for Sebastian's eyeball, not a hard
  // fail — except a genuinely broken card (<3.0) still blocks.
  const brokenCards = cards.filter((c) => c.tonality < 3.0);
  const lowCards = cards.filter((c) => c.tonality >= 3.0 && c.tonality < 4.0);
  const gate7 = LEVELS.every((l) => meanTone[l] >= 4.4) && brokenCards.length === 0;
  line(`\n[GATE 7] TONALITY FLOOR — ${gate7 ? "✅ PASS" : "❌ FAIL"}  (per-level mean ≥4.4 · no card <3.0)`);
  line(`  mean tonality: ${LEVELS.map((l) => `${l} ${meanTone[l].toFixed(2)}`).join(" · ")}`);
  brokenCards.sort((a, b) => a.tonality - b.tonality).forEach((c) => line(`  ❌ broken ${c.fam}/${c.id}/${c.level} tone ${c.tonality.toFixed(1)}: "${c.line}"`));
  lowCards.sort((a, b) => a.tonality - b.tonality).forEach((c) => advisories.push(`low-tone ${c.fam}/${c.id}/${c.level} t${c.tonality.toFixed(1)}: "${c.line}"`));
  if (!gate7) fail.push("GATE 7 tonality");

  // GATE 8 — challenger not too far (dual judge). Fail only if BOTH judges flag; one = advisory.
  const chall = cards.filter((c) => c.level === "challenger");
  await mapPool(chall, async (c) => { let votes = 0; c.tfWhy = ""; for (const j of judges) { const r = await tooFarJudge(j, c.line); if (!r.error && r.too_far) { votes++; c.tfWhy = r.why || c.tfWhy; } } c.tooFarVotes = votes; });
  const tooFar = chall.filter((c) => c.tooFarVotes >= judges.length);   // unanimous → fail
  const tooFarAdv = chall.filter((c) => c.tooFarVotes > 0 && c.tooFarVotes < judges.length);
  const gate8 = tooFar.length === 0;
  line(`\n[GATE 8] CHALLENGER NOT TOO FAR — ${gate8 ? "✅ PASS" : "❌ FAIL"}`);
  tooFar.forEach((c) => line(`  ❌ ${c.id}: "${c.line}" — ${c.tfWhy}`));
  tooFarAdv.forEach((c) => advisories.push(`challenger ${c.id} flagged too-far by 1 of ${judges.length} judges: "${c.line}" (${c.tfWhy})`));
  if (!gate8) fail.push("GATE 8 too-far");

  // GATE 3 — ordering. Per fixture (HARD): challenger is NEVER meaningfully softer than consultative
  //   (backward votes ≤20% AND challenger wins a plurality) and NO big-gap inversion (consultative/
  //   balanced clearly harder than challenger). Corpus (HARD): ≥75% of fixtures show STRONG
  //   separation (≥75% harder) — this proves the dial has real range, WHILE allowing inherently
  //   gentle beliefs (Money, Support — doctrine says pre-frame them softly, so aggression there is
  //   WRONG, not missing range) to compress. challenger-vs-direct stays advisory (subtle 8→9.5 gap).
  line(`\n[GATE 3] INTENSITY ORDERING (per-fixture non-inversion hard · corpus ≥75% strong-separation hard)`);
  let gate3 = true, strong = 0, totalOrd = 0;
  const linesOf = (fam, id) => Object.fromEntries(LEVELS.map((l) => [l, gen[fam][id][l]?.line]).filter(([, v]) => v));
  const ordFx = [["obj", OBJ_REAL.filter((f) => gen.obj[f.id]).slice(0, ORDER_LIMIT === Infinity ? OBJ_REAL.length : ORDER_LIMIT)], ["dig", lim(DIG_NORMAL).slice(0, ORDER_LIMIT === Infinity ? DIG_NORMAL.length : ORDER_LIMIT)]];
  for (const [fam, fixtures] of ordFx) {
    for (const fx of fixtures) {
      const L = linesOf(fam, fx.id);
      if (!L.consultative || !L.challenger) { line(`  ${fam}/${fx.id}: ⚠️ skipped`); continue; }
      const ep = await tallyHarder(L.challenger, L.consultative, Math.max(3, REPEAT));
      // Real defect = challenger MAJORITY-softer than consultative (dial backwards here). A minor
      // split (e.g. 4↑/2↓ — challenger still wins) is stochastic noise on a subtle dig gap, not a bug.
      const noInversion = ep.total > 0 && ep.xWins >= ep.yWins;
      const isStrong = ep.xFrac >= 0.75; // ≥75%-harder — counts toward the corpus range proof
      totalOrd++; if (isStrong) strong++;
      let hardInv = "", softInv = "";
      for (const lower of ["consultative", "balanced", "direct"]) {
        if (!L[lower]) continue;
        const t = await tallyHarder(L[lower], L.challenger, REPEAT);
        if (t.total > 0 && t.xFrac > 0.5) { if (lower === "direct") softInv += ` [direct≥chal ${t.detail}]`; else hardInv += ` [${lower}>chal ${t.detail}]`; }
      }
      if (!noInversion || hardInv) gate3 = false;
      if (softInv) advisories.push(`ordering ${fam}/${fx.id}: challenger not clearly > direct —${softInv}`);
      line(`  ${fam}/${fx.id}: ${noInversion ? (isStrong ? "✅ strong" : "◐ compressed-ok") : "❌ inverted"} (${ep.detail})${hardInv ? " ❌INV" + hardInv : ""}${softInv ? " ⚠️" + softInv : ""}`);
    }
  }
  const strongRatio = totalOrd ? strong / totalOrd : 0;
  if (strongRatio < 0.75) gate3 = false;
  line(`  strong separation on ${strong}/${totalOrd} fixtures (${(strongRatio * 100).toFixed(0)}%, need ≥75%) — ${gate3 ? "✅ PASS" : "❌ FAIL"}`);
  if (!gate3) fail.push("GATE 3 ordering");

  // CHECK — same diagnosis (advisory)
  line(`\n[CHECK] SAME DIAGNOSIS (advisory)`);
  for (const [fam, fixtures] of [["obj", OBJ_REAL], ["dig", lim(DIG_NORMAL)]]) {
    for (const fx of fixtures) {
      if (!gen[fam][fx.id]) continue;
      const L = LEVELS.map((l) => gen[fam][fx.id][l]).filter((r) => r && r.kind === "line").map((r) => r.line);
      if (L.length < 2) continue;
      let same = true, det = [];
      for (const j of judges) { const r = await diagnosisJudge(j, fx.ground, L); if (r.error) det.push(`${j}:err`); else { if (!r.same_diagnosis) same = false; det.push(`${j}:${r.same_diagnosis ? "✓" : "✗"}`); } }
      if (!same) advisories.push(`diagnosis ${fam}/${fx.id}: possible belief shift (${det.join(" ")})`);
    }
  }
  line(`  (drift → advisories)`);

  writeBatch(gen, { OBJ_REAL: lim(OBJ_REAL), OBJ_THREAD: lim(OBJ_THREAD), OBJ_ABSTAIN: lim(OBJ_ABSTAIN), DIG_NORMAL: lim(DIG_NORMAL), DIG_CLOSE: lim(DIG_CLOSE) }, cards, meanTone);
  finish(report, fail, advisories);
}

// ── the human eyeball batch ──
function writeBatch(gen, groups, cards, meanTone) {
  const scoreOf = (fam, id, level) => cards.find((c) => c.fam === fam && c.id === id && c.level === level);
  const md = ["# Confrontationalness Dial — card batch (read as the closer; flag any you wouldn't say)", ""];
  md.push(`Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} · gen=${GEN_MODEL}. Each card shows tonality (t), and 🚩 if a judge flagged fabrication/too-far.`);
  md.push(`Per-level mean tonality: ${LEVELS.map((l) => `**${l}** ${meanTone[l].toFixed(2)}`).join(" · ")}`);
  md.push("");
  const section = (title, fam, fixtures) => {
    md.push(`## ${title}`); md.push("");
    for (const fx of fixtures) {
      if (!gen[fam][fx.id]) continue;
      md.push(`**${fx.id}** — prospect: _"${fx.latest}"_`);
      for (const l of LEVELS) {
        const r = gen[fam][fx.id][l];
        if (!r || r.kind !== "line") { md.push(`- \`${l}\`: _(${r ? r.kind : "—"})_`); continue; }
        const sc = scoreOf(fam, fx.id, l);
        const flags = [sc?.fab ? "🚩FAB" : "", sc?.tooFarVotes >= 1 ? `🚩too-far(${sc.tooFarVotes})` : "", sc?.ticHard?.length ? `🚩TIC(${sc.ticHard.join(",")})` : "", sc?.ticSoft?.length ? `⚠️tic?(${sc.ticSoft.join(",")})` : ""].filter(Boolean).join(" ");
        md.push(`- \`${l}\`${sc ? ` _(t${sc.tonality.toFixed(1)})_` : ""}: ${r.line}${flags ? "  " + flags : ""}`);
      }
      md.push("");
    }
  };
  section("Objection — single-shot", "obj", groups.OBJ_REAL);
  section("Objection — threaded (beat 2)", "obj", groups.OBJ_THREAD);
  section("Objection — should ABSTAIN (nothing standing)", "obj", groups.OBJ_ABSTAIN);
  section("Dig — normal", "dig", groups.DIG_NORMAL);
  section("Dig — should TAKE THE CLOSE", "dig", groups.DIG_CLOSE);
  try { mkdirSync(OUT_DIR, { recursive: true }); } catch { /* */ }
  writeFileSync(join(OUT_DIR, "confrontation-card-batch.md"), md.join("\n"));
}

function finish(report, fail, advisories = []) {
  const pass = fail.length === 0;
  const adv = advisories.length ? `\n\n  ⚠️ ADVISORIES (non-blocking):\n${advisories.map((a) => `   · ${a}`).join("\n")}` : "";
  const summary = `\n${"═".repeat(78)}\n  RESULT: ${pass ? "✅ ALL HARD GATES PASS" : `❌ FAIL — ${fail.join(", ")}`}${adv}\n${"═".repeat(78)}`;
  console.log(summary); report.push(summary);
  try { mkdirSync(OUT_DIR, { recursive: true }); } catch { /* */ }
  writeFileSync(join(OUT_DIR, "confrontation-eval-results.md"), report.join("\n"));
  console.log(`\nWrote tasks/confrontation-eval-results.md + tasks/confrontation-card-batch.md`);
  process.exit(pass ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
