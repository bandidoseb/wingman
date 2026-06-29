/**
 * scripts/test-belief-ladder.mjs — REAL pass/fail gate for the Belief Ladder summarizer.
 *
 * Two modes:
 *   node scripts/test-belief-ladder.mjs            # GATE: run fixtures, assert, exit 0/1
 *   node scripts/test-belief-ladder.mjs --explore [file.txt] [--haiku-only] [--verbose]
 *                                                  # human read: roll a transcript, print scorecards
 *
 * WHY THE REWRITE (plan-review C4, 2026-06-28): the old harness had (a) a DUPLICATE copy
 * of the system prompt that drifted from the lib, so it tested a stale prompt, and (b) NO
 * assertions — it printed a checklist for a human to eyeball. So "re-run the harness" proved
 * nothing. Now:
 *   - The prompt + model + token cap are read from src/lib/wingman/belief-ladder.ts at runtime
 *     (single source of truth — no copy to drift).
 *   - The gate asserts the confidence-number rule: a number said ONCE (unconfirmed) must NOT
 *     appear as digits; a CONFIRMED (stated + echoed) number MUST appear. Exit 1 on any miss.
 *
 * NOTE: this gate is RED against the current prompt on purpose — the confidence rule is the
 * Phase 2 edit. It goes GREEN once belief-ladder.ts gets that rule. That's the gate working.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Load .env.local for ANTHROPIC_API_KEY ──────────────────────────────────────
const envFile = path.join(__dirname, "../.env.local");
if (fs.existsSync(envFile)) {
  const raw = fs.readFileSync(envFile, "utf-8").replace(/^﻿/, "");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (k && !process.env[k]) process.env[k] = v;
  }
}
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) { console.error("❌ ANTHROPIC_API_KEY not found in .env.local"); process.exit(1); }

// ─── SINGLE SOURCE OF TRUTH: read the prompt/model/cap from the production lib ───
// No duplicate copy. If the export shape changes, fail loud rather than test a stale string.
const libText = fs.readFileSync(path.join(__dirname, "../src/lib/wingman/belief-ladder.ts"), "utf-8");
const promptMatch = libText.match(/BELIEF_LADDER_SYSTEM_PROMPT\s*=\s*`([\s\S]*?)`;/);
const modelMatch  = libText.match(/BELIEF_LADDER_MODEL\s*=\s*"([^"]+)"/);
const maxTokMatch = libText.match(/BELIEF_LADDER_MAX_TOKENS\s*=\s*(\d+)/);
if (!promptMatch || !modelMatch || !maxTokMatch) {
  console.error("❌ Could not extract BELIEF_LADDER_{SYSTEM_PROMPT,MODEL,MAX_TOKENS} from belief-ladder.ts");
  process.exit(1);
}
const SYSTEM_PROMPT = promptMatch[1];
const PROD_MODEL    = modelMatch[1];
const MAX_TOKENS    = Number(maxTokMatch[1]);

const HAIKU = "claude-haiku-4-5-20251001";

// ─── One summarizer call ─────────────────────────────────────────────────────────
async function callModel(model, currentSummary, newChunk) {
  const userMessage =
    `CURRENT SCORECARD:\n${currentSummary || "(empty — this is the start of the call)"}\n\n` +
    `NEW TRANSCRIPT (only what was said since the last update):\n${newChunk}`;
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT, messages: [{ role: "user", content: newChunk ? userMessage : "" }] }),
  });
  if (!resp.ok) throw new Error(`${model} API error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return (data.content?.[0]?.text ?? "").trim();
}

// ════════════════════════════════════════════════════════════════════════════════
// GATE FIXTURES — small, purpose-built. Each asserts on the final scorecard text.
// The core rule under test (Phase 2): unconfirmed number → dropped; confirmed → kept.
// ════════════════════════════════════════════════════════════════════════════════
const FIXTURES = [
  {
    name: "Unconfirmed goal number is NOT recorded as digits",
    transcript:
      "Rep: If we fixed this, what would good actually look like for you?\n" +
      "Prospect: I dunno, maybe like 50k a month someday would be nice I guess.\n" +
      "Rep: Got it. What's the biggest thing in the way right now?\n" +
      "Prospect: Everything runs through me — I've got no systems at all.",
    asserts: [
      {
        desc: "output must NOT contain the once-said figure 50k",
        ok: (out) => !/\b50\s*k\b|\$\s*50\b|50,000/i.test(out),
        whyRed: "current prompt records $GOAL even when the number was said once, vaguely — this is exactly what Phase 2 fixes",
      },
    ],
  },
  {
    name: "Confirmed (stated + echoed) revenue IS recorded",
    transcript:
      "Rep: Where's the business at right now, revenue-wise?\n" +
      "Prospect: We're doing about 30k a month.\n" +
      "Rep: 30k a month — got it. And how long have you been stuck there?\n" +
      "Prospect: Couple years now, honestly.",
    asserts: [
      {
        desc: "output MUST contain the confirmed figure 30k",
        ok: (out) => /\b30\s*k\b|\$\s*30\b|30,000/i.test(out),
        whyRed: "if this fails, the confidence rule is too aggressive — it's dropping CONFIRMED numbers too",
      },
    ],
  },
  {
    name: "No hallucinated figure the prospect never said",
    transcript:
      "Rep: What's pushing you to solve this now?\n" +
      "Prospect: I'm just tired of being stuck. It's wearing me down.\n" +
      "Rep: Totally hear that. What have you tried already?\n" +
      "Prospect: A few things on my own, nothing really stuck.",
    asserts: [
      {
        desc: "output must contain NO dollar/k figure (none was ever said)",
        ok: (out) => !/\$\s*\d|\b\d+\s*k\b|\d,\d{3}/i.test(out),
        whyRed: "the model invented a number from a number-free conversation",
      },
    ],
  },
];

async function runGate() {
  console.log("═".repeat(72));
  console.log("  BELIEF LADDER — GATE (prompt read live from belief-ladder.ts)");
  console.log(`  model=${PROD_MODEL} max_tokens=${MAX_TOKENS} · ${FIXTURES.length} fixtures`);
  console.log("═".repeat(72));

  let failed = 0;
  for (const fx of FIXTURES) {
    let out;
    try {
      out = await callModel(PROD_MODEL, "", fx.transcript);
    } catch (e) {
      console.log(`\n✗ ${fx.name}\n    ERROR: ${e.message}`);
      failed++;
      continue;
    }
    for (const a of fx.asserts) {
      const pass = a.ok(out);
      console.log(`\n${pass ? "✓ PASS" : "✗ FAIL"}  ${fx.name}`);
      console.log(`        ${a.desc}`);
      if (!pass) {
        failed++;
        console.log(`        why: ${a.whyRed}`);
        const gap = out.match(/▸ THE GAP[\s\S]*?(?=▸ BELIEF|$)/)?.[0] ?? out.slice(0, 280);
        console.log("        ── scorecard GAP section ──");
        console.log(gap.split("\n").map((l) => "        " + l).join("\n"));
      }
    }
  }

  console.log("\n" + "═".repeat(72));
  if (failed === 0) {
    console.log("  ✅ GATE PASS — summarizer honors the confidence-number rule");
    console.log("═".repeat(72));
    process.exit(0);
  } else {
    console.log(`  ❌ GATE FAIL — ${failed} assertion(s) failed`);
    console.log("  (RED against the pre-Phase-2 prompt is EXPECTED — it proves the gate bites.)");
    console.log("═".repeat(72));
    process.exit(1);
  }
}

// ─── Explore mode: roll a transcript and print scorecards for a human read ───────
const MOCK_TRANSCRIPT = `Rep: Marcus, appreciate you hopping on. What made you book this call?
Prospect: I've run my Shopify store three years and hit a ceiling — can't break past 40k a month.
Rep: What's that costing you right now?
Prospect: I'm working 70 hour weeks, barely see my kids. My wife's been on me about it.
Rep: If we fixed one thing, what would worth-it look like?
Prospect: 100k a month consistently. That's where I could hire a team and step back.
Rep: What have you tried?
Prospect: Courses, a freelancer for ads that burned me — dropped 8k, got nothing. I know what to do, I just can't execute alone.
Rep: Is scaling to 100k a this-year commitment or a someday thing?
Prospect: This year. I told my wife if it's not different by year-end I'd go back to a job. That'd kill me.`;

function chunk(text, n = 6) {
  const lines = text.split("\n").filter((l) => l.trim());
  const out = [];
  for (let i = 0; i < lines.length; i += n) out.push(lines.slice(i, i + n).join("\n"));
  return out;
}

async function runExplore(args) {
  const haikuOnly = args.includes("--haiku-only");
  const verbose   = args.includes("--verbose");
  const file      = args.find((a) => !a.startsWith("--") && a !== "--explore");
  const transcript = file ? fs.readFileSync(path.resolve(file), "utf-8") : MOCK_TRANSCRIPT;
  const chunks = chunk(transcript);

  const roll = async (model) => {
    let summary = "";
    for (let i = 0; i < chunks.length; i++) {
      summary = await callModel(model, summary, chunks[i]);
      if (verbose) console.log(`\n── ${model} after chunk ${i + 1}/${chunks.length} ──\n${summary}`);
    }
    return summary;
  };

  console.log(`Exploring ${file ? path.resolve(file) : "(mock)"} — ${chunks.length} ticks · prompt from belief-ladder.ts`);
  const jobs = [roll(PROD_MODEL)];
  if (!haikuOnly) jobs.unshift(roll(HAIKU));
  const results = await Promise.all(jobs);
  if (!haikuOnly) { console.log("\n===== HAIKU =====\n" + results[0]); console.log("\n===== SONNET (prod model) =====\n" + results[1]); }
  else            { console.log("\n===== " + PROD_MODEL + " =====\n" + results[0]); }
  console.log("\n(Explore mode is for human reading — run with no args for the pass/fail GATE.)");
}

const args = process.argv.slice(2);
const run = args.includes("--explore") ? runExplore(args) : runGate();
run.catch((err) => { console.error("\n❌ Harness error:", err.message); process.exit(1); });
