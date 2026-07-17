/**
 * voice-batch.mjs — the Phase 1 VOICE-GRIND tool. Generates DIRECT-ONLY (base voice) cards
 * for Sebastian to tear apart. No dial levels, no LLM judges — Sebastian IS the judge.
 *
 *   node scripts/voice-batch.mjs            # generate the batch → tasks/voice-batch.md
 *   DRY=1 node scripts/voice-batch.mjs      # no API calls — prove wiring
 *   GEN_MODEL=claude-sonnet-4-6 …           # override the generator model
 *   LIMIT=4 node scripts/voice-batch.mjs    # first N fixtures per family (quick smoke)
 *
 * Uses the REAL production builders (objection-prompt.mjs / dig-prompt.mjs) at the `direct`
 * level, so the batch is exactly the shipped base voice. Runs the deterministic tic gate
 * (tic-gate.mjs) so any mechanical tic is flagged before Sebastian reads it.
 *
 * OUTPUT: tasks/voice-batch.md — one card per fixture with a ✓ / ✗ / rewrite slot. Sebastian
 * fills the Verdict + Rewrite inline; next session Claude ingests the rewrites into the base
 * prompt few-shot anchors + the tic-gate ban-list. This is the human-in-the-loop reward signal.
 *
 * FIXTURES live in THIS file on purpose — the grind adds/edits situations constantly; keeping
 * them here (not shared with the dial eval) means editing the batch never risks the dial gate.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildObjectionSystemPrompt, buildObjectionUserSegments } from "../src/lib/wingman/objection-prompt.mjs";
import { buildDigSystemPrompt, buildDigUserSegments } from "../src/lib/wingman/dig-prompt.mjs";
import { scanTics } from "./tic-gate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../tasks");

function loadEnv() {
  try {
    const text = readFileSync(join(__dirname, "../.env.local"), "utf8");
    for (const l of text.split("\n")) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch { /* env optional in DRY */ }
}
loadEnv();

const DRY       = !!process.env.DRY;
const GEN_MODEL = process.env.GEN_MODEL || "claude-sonnet-4-6";
const LIMIT     = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
const POOL      = process.env.POOL ? Number(process.env.POOL) : 4;
const KEY       = process.env.ANTHROPIC_API_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lim = (arr) => (LIMIT === Infinity ? arr : arr.slice(0, LIMIT));

async function mapPool(items, fn, pool = POOL) {
  const out = new Array(items.length);
  let i = 0;
  const worker = async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(pool, items.length)) }, worker));
  return out;
}

async function anthropic(system, user, maxTokens = 150) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 30_000);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: GEN_MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
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

const flatten = (segs) => segs.map((s) => s.text).join("");
function parseLine(text) {
  const cleaned = String(text).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let p = null;
  try { p = JSON.parse(cleaned); } catch { const m = cleaned.match(/\{[\s\S]*\}/); if (m) { try { p = JSON.parse(m[0]); } catch { /* */ } } }
  if (p && typeof p.line === "string" && p.line.trim()) return p.line.trim();
  if (p && p.line === null) return null;
  const m = String(text).match(/"line"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m && m[1].trim()) return m[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim();
  if (/"line"\s*:\s*null/.test(String(text))) return null;
  return "(unparseable)";
}

// ── FIXTURES (direct/base voice grind — edit freely; these ARE the coverage set) ──
const OBJ = [
  { id: "money-tight", belief: "1 Pain ✅ — hates the grind\n4 Desire ✅ — wants $30k months\n5 Money ⚠️ — flinched at price", latest: "Honestly that's a lot of money right now. I don't know." },
  { id: "money-anchor", belief: "1 Pain ✅\n4 Desire ✅\n5 Money ⚠️ — sticker shock", latest: "I mean… that's a lot more than I was expecting to spend on this." },
  { id: "think", belief: "1 Pain 🟡 — busy, overwhelmed\n7 Trust ⬜", latest: "Yeah this sounds good, let me think about it and get back to you." },
  { id: "trust-burned", belief: "7 Trust ⚠️ — burned by a past coach\n1 Pain ✅ — stuck at $10k", latest: "I've done a coaching thing before and it was a waste. How's this any different?" },
  { id: "fear", belief: "1 Pain ✅ — miserable in job\n4 Desire ✅ — wants to go full-time\n5 Money 🟡", latest: "I mean… this is a big decision. What if it doesn't work out for me?" },
  { id: "partner", belief: "1 Pain ✅\n4 Desire ✅\n6 Support ⚠️ — spouse not on call", latest: "I'd need to talk to my wife before I make a decision like this." },
  { id: "timing", belief: "1 Pain ✅\n3 Cost ⬜\n4 Desire ✅", latest: "Now's just not a great time for me. Maybe next quarter would be better." },
  { id: "send-info", belief: "1 Pain 🟡\n7 Trust ⬜", latest: "Can you just send me some information and I'll look it over on my own time?" },
  { id: "diy", belief: "1 Pain ✅ — stalled 18 months\n2 Doubt ⚠️ — thinks he can DIY", latest: "Honestly I feel like I could probably just figure this out on my own." },
  { id: "competitor", belief: "1 Pain ✅\n7 Trust 🟡 — comparison shopping", latest: "I'm actually looking at a couple other options too, so I'm not sure yet." },
  { id: "skeptic", belief: "1 Pain ✅\n2 Doubt ⚠️ — doubts it'll work for HIM", latest: "How do I actually know this'll work for someone like me?" },
  { id: "wishy-washy", belief: "1 Pain 🟡\n4 Desire 🟡 — lukewarm all call", latest: "Yeah… maybe. I don't know, I'm not really sure about it." },
  { id: "too-busy", belief: "1 Pain ✅ — overwhelmed IS the problem\n3 Cost ⬜", latest: "I'm slammed right now, I really don't have time to take on something new." },
  { id: "results-doubt", belief: "1 Pain ✅\n2 Doubt ⚠️\n7 Trust 🟡", latest: "I've seen a lot of people not really get results from stuff like this, you know?" },
];
const DIG = [
  { id: "open-pain", belief: "1 Pain ⬜\n4 Desire ⬜", latest: "Things are just kind of stuck right now, you know?" },
  { id: "deepen-desire", belief: "1 Pain ✅\n4 Desire 🟡 — 'more money', no number", latest: "I just want to be making more money, more consistently." },
  { id: "cost", belief: "1 Pain ✅ — stuck 2 years\n3 Cost ⬜", latest: "Yeah it's been about two years at this same spot honestly." },
  { id: "doubt-diy", belief: "1 Pain ✅\n2 Doubt 🟡 — tried on own", latest: "I've bought a few courses and tried to do it myself but it just hasn't clicked." },
  { id: "trust-why", belief: "1 Pain ✅\n7 Trust ⬜", latest: "I've tried programs before that overpromised, so I'm a little cautious." },
  { id: "support", belief: "1 Pain ✅\n4 Desire ✅\n6 Support ⬜", latest: "Yeah this is the kind of thing I'd want to get right." },
  { id: "money-qualifier", belief: "1 Pain ✅\n2 Doubt ✅\n4 Desire ✅\n5 Money ⬜ — other beliefs built", latest: "Yeah honestly everything you're saying makes a lot of sense to me." },
  { id: "vague", belief: "1 Pain 🟡 — vague\n4 Desire ⬜", latest: "I don't know, I just want things to be better than they are now." },
];

async function genObj(fx) {
  if (DRY) return `(dry) ${fx.latest.slice(0, 40)}`;
  const system = buildObjectionSystemPrompt("direct");
  const user = flatten(buildObjectionUserSegments({ liveSummary: fx.belief, latestResponse: fx.latest }));
  const { text, error } = await anthropic(system, user);
  return error ? `(error ${error})` : parseLine(text);
}
async function genDig(fx) {
  if (DRY) return `(dry) ${fx.latest.slice(0, 40)}`;
  const system = buildDigSystemPrompt("direct");
  const user = flatten(buildDigUserSegments({ liveSummary: fx.belief, latestResponse: fx.latest }));
  const { text, error } = await anthropic(system, user);
  return error ? `(error ${error})` : parseLine(text);
}

async function run() {
  if (!DRY && !KEY) { console.error("Missing ANTHROPIC_API_KEY (or DRY=1)"); process.exit(1); }
  const obj = lim(OBJ), dig = lim(DIG);
  console.log(`Generating ${obj.length} objection + ${dig.length} dig DIRECT cards · gen=${GEN_MODEL}${DRY ? " · DRY" : ""}…`);
  const objLines = await mapPool(obj, genObj);
  const digLines = await mapPool(dig, genDig);

  const md = [
    "# Wingman Voice Batch — DIRECT (base voice) · read as the closer",
    "",
    `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} · gen=${GEN_MODEL}. Base/default voice only — no dial levels.`,
    "",
    "**How to mark each card:** set `Verdict:` to `✓` (I'd say it), `✗` (wrong move — kill it), or write your",
    "rewrite after `Rewrite:`. Add one line of `Why:` when you red-light or rewrite. 🚩TIC = the gate caught a",
    "mechanical tic (should be none on a clean base); ⚠️tic? = an advisory (e.g. dig's personal pre-frame).",
    "",
  ];
  const section = (title, fam, fixtures, lines) => {
    md.push(`## ${title}`, "");
    fixtures.forEach((fx, i) => {
      const line = lines[i];
      const t = typeof line === "string" ? scanTics(line, fam === "obj" ? "objection" : "dig") : { hard: [], soft: [] };
      const flags = [t.hard.length ? `🚩TIC(${t.hard.join(",")})` : "", t.soft.length ? `⚠️tic?(${t.soft.join(",")})` : ""].filter(Boolean).join(" ");
      md.push(`### ${fx.id}${flags ? "  " + flags : ""}`);
      md.push(`Prospect: _"${fx.latest}"_`);
      md.push(`Card: **${line === null ? "(abstain / take the close)" : line}**`);
      md.push(`Verdict: `);
      md.push(`Rewrite: `);
      md.push(`Why: `);
      md.push("");
    });
  };
  section("Objection — direct", "obj", obj, objLines);
  section("Dig — direct", "dig", dig, digLines);

  try { mkdirSync(OUT_DIR, { recursive: true }); } catch { /* */ }
  writeFileSync(join(OUT_DIR, "voice-batch.md"), md.join("\n"));
  console.log(`Wrote tasks/voice-batch.md (${obj.length + dig.length} cards).`);
}
run().catch((e) => { console.error(e); process.exit(1); });
