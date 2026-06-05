/**
 * scripts/test-belief-ladder.mjs — OFFLINE prompt-quality harness for the Phase 2
 * Belief Ladder summarizer.
 *
 * WHY THIS EXISTS (read the Phase 2 design doc → "Prompt quality = the #1 lever"):
 * You cannot judge an extraction prompt by reading it — only by running it on a real
 * transcript and reading the output. This harness lets us tune the summarizer prompt
 * and SEE the Haiku-vs-Sonnet quality gap before any of it touches the live pipeline.
 *
 * It simulates the real production behavior: the summarizer runs on a TIMER, each time
 * receiving [current scorecard] + [only the new transcript since last update] and
 * returning an updated scorecard. So we feed the transcript in CHUNKS, rolling the
 * scorecard forward chunk by chunk — exactly like the ~90s live ticks.
 *
 * USAGE:
 *   node scripts/test-belief-ladder.mjs                      # runs the built-in mock transcript
 *   node scripts/test-belief-ladder.mjs path/to/call.txt     # runs YOUR real transcript
 *   node scripts/test-belief-ladder.mjs path/to/call.txt --verbose   # also prints each rolling step
 *   node scripts/test-belief-ladder.mjs --haiku-only         # skip Sonnet (cheaper while iterating the prompt)
 *
 * Transcript file format: plain text, one "Speaker: line" per line (same shape the app buffers).
 *
 * NOTE: this is the TUNING SANDBOX. Once the prompt is locked + quality-approved, the
 * final SYSTEM_PROMPT is lifted verbatim into src/lib/wingman/belief-ladder.ts (the
 * production lib) when we build the /summarize route + persistence. One source of truth.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Load .env.local so we get ANTHROPIC_API_KEY (mirrors wait-and-launch.js) ──
const envFile = path.join(__dirname, "../.env.local");
if (fs.existsSync(envFile)) {
  const raw = fs.readFileSync(envFile, "utf-8").replace(/^﻿/, ""); // strip BOM if present
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    // Set if missing OR empty — a pre-set-but-EMPTY shell var must not block the real .env.local value.
    if (k && !process.env[k]) process.env[k] = v;
  }
}

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY not found in .env.local — cannot run.");
  process.exit(1);
}

// ─── Models + APPROX pricing (per-MTok; CONFIRM exact rates before committing) ──
const HAIKU  = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-6";
const RATES = {                          // $ per 1M tokens — APPROXIMATE, label as such
  [HAIKU]:  { in: 1.00, out: 5.00 },
  [SONNET]: { in: 3.00, out: 15.00 },
};

// ─── Chunking: simulate ~90s live ticks by feeding the transcript in slices ────
const LINES_PER_CHUNK = 6;

// ─── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const VERBOSE   = args.includes("--verbose");
const HAIKU_ONLY = args.includes("--haiku-only");
const filePath  = args.find((a) => !a.startsWith("--"));

// ════════════════════════════════════════════════════════════════════════════════
// THE #1 ARTIFACT — the summarizer system prompt. Tune THIS. Everything else is wiring.
// ════════════════════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `You are Wingman's live-call memory — an elite high-ticket closing coach (Cole Gordon / Jeremy Miner caliber) silently maintaining a running scorecard of a sales call AS IT HAPPENS.

You are GRADING BELIEF, not transcribing. This scorecard is read later to coach the rep and to power live help, so it must be brutally honest and grounded ONLY in what was actually said.

You receive the CURRENT SCORECARD (everything known so far) + NEW TRANSCRIPT (only what was said since the last update). You output the UPDATED SCORECARD — the same fixed structure, refreshed.

OUTPUT EXACTLY THIS STRUCTURE (fill the blanks, keep every line tight; use "—" when unknown):

LIVE CALL MEMORY
Stage: <Rapport|Discovery|Press|Confirm|Pitch|Close> · Elapsed: <the CALL ELAPSED value from the input, e.g. 23m; — if not provided> · Syntax: <problems-first|goals-first|—>
▸ THE GAP
  Current "hell":   <where they are now — numbers + specifics, or —>
  Desired "heaven": <what they want> · $GOAL <number or —> · why that #: <reason or —>
  Final straw / emotional why: <their line-in-the-sand moment, or —>
  Core driver: <Certainty|Significance|Growth|Variety|Connection|Contribution|—>
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ at-risk/objection)
  1 Pain                 <status> — <one-line evidence or —>
  2 Doubt (can't DIY)    <status> — <…>
  3 Cost (of inaction)   <status> — <…>
  4 Desire               <status> — <…>
  5 Money                <status> — <…>
  6 Support (who decides) <status> — <…>
  7 Trust (why you)      <status> — <…>
▸ THEIR EXACT WORDS (verbatim, for tie-downs)
  • "<quote>"
  • "<quote>"
▸ OPEN OBJECTIONS: <none | the objection + (handled / open)>
▸ WEAKEST LINK → <the belief(s) to shore up before closing>

HOW TO GRADE EACH BELIEF (evidence bar — be strict):
- ✅ locked — the PROSPECT affirmed it in their OWN words. The rep saying it, or you inferring it, does NOT count. Point to the evidence.
- 🟡 partial — touched or implied, but no clear prospect affirmation yet.
- ⬜ open — not yet addressed. Leave it open. NEVER fill it from assumption to look complete.
- ⚠️ at-risk/objection — the prospect raised hesitation, pushback, or a contradiction here.

HARD RULES:
- Record ONLY what was actually said. No flattering inferences. An honest ⬜ beats a hallucinated ✅.
- A rep ASSERTING pain ≠ the prospect CONFIRMING it. Grade what the PROSPECT did, not what the rep framed.
- "Their exact words" must be VERBATIM from the transcript — never paraphrased (tie-downs depend on the exact words). Keep the 2–4 most useful quotes.
- UPDATE IN PLACE: this is a running scorecard, not a log. Merge new info into the existing structure; carry forward what's still true.
- RECENT OVERRIDES STALE: if the new transcript contradicts the current scorecard (e.g. the budget number changed), REPLACE the old value — never keep both.
- Keep it COMPACT and roughly FIXED-SIZE: one line per field. It must NOT grow longer as the call goes on.
- WEAKEST LINK is the most important line — it is NEVER blank. Always name the belief(s) with the lowest status, in priority order: ⚠️ at-risk first, then ⬜ open, then 🟡 partial. If everything is ✅, say "all beliefs locked — ready to close."
- Output ONLY the scorecard. No preamble, no commentary, no markdown fences.

WORKED EXAMPLE (grade honestly — do not inflate):
NEW TRANSCRIPT:
  Rep: So it sounds like cash flow is really the thing keeping you up at night, right?
  Dana: I mean... yeah, things are tight, but we're managing. I've been doing this seven years.
CORRECT GRADING:
  1 Pain → 🟡 partial — "things are tight" but softened with "we're managing"; not a locked admission.
  2 Doubt (can't DIY) → ⚠️ at-risk — "I've been doing this seven years" signals they believe they can figure it out themselves.
  Do NOT mark Pain ✅ just because the rep framed it — Dana never fully owned it.`;

// ─── A realistic built-in transcript so the harness runs out of the box ─────────
const MOCK_TRANSCRIPT = `Rep: Marcus, appreciate you hopping on. Before we dig in — what made you book this call specifically?
Marcus: Honestly I've been running my Shopify store for about three years and I've hit a ceiling. We're doing okay but I can't break past 40k a month no matter what I try.
Rep: Got it. And when you say a ceiling — what's that actually costing you right now?
Marcus: It's frustrating. I'm working 70 hour weeks, I barely see my kids. My wife's been on me about it. I keep reinvesting but the needle doesn't move.
Rep: That sounds exhausting. If we could fix one thing, what would the business need to look like for you to feel like this was worth it?
Marcus: I'd want to be at 100k a month consistently. That's the number where I could finally hire a real team and step back a bit.
Rep: Why 100k specifically?
Marcus: At 100k I can pay myself properly, hire an ops person, and actually take a weekend off. Right now every dollar is tied up.
Rep: Makes sense. What have you tried so far to break the ceiling?
Marcus: I've done a couple courses, hired a freelancer for ads that burned me, watched a ton of YouTube. I feel like I know what to do, I just can't execute it all alone.
Rep: When you say the freelancer burned you — what happened?
Marcus: Dropped 8k on ads with no system, got nothing back. Made me gun-shy about spending on help again.
Rep: I hear you. So if there were a proven system and someone in your corner — is scaling to 100k something you're committed to this year, or more of a someday thing?
Marcus: No, it has to be this year. I told my wife if it's not different by the end of the year I'd go back to a job. That would kill me honestly.
Rep: That's a real line in the sand. When you find the right fit, are you the one who makes the call, or do you and your wife decide together?
Marcus: We talk about big stuff together, but the business decisions are mine.
Rep: Good. And ballpark — have you set aside anything to invest in getting this solved?
Marcus: I mean, it depends what it is. After the ads thing I'm careful. I'd need to know it actually works before I drop serious money.`;

// ─── One summarizer call: [current scorecard] + [new transcript] → updated ──────
async function callModel(model, currentSummary, newChunk) {
  const userMessage =
    `CURRENT SCORECARD:\n${currentSummary || "(empty — this is the start of the call)"}\n\n` +
    `NEW TRANSCRIPT (only what was said since the last update):\n${newChunk}`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!resp.ok) {
    throw new Error(`${model} API error ${resp.status}: ${await resp.text()}`);
  }

  const data = await resp.json();
  const text = (data.content?.[0]?.text ?? "").trim();
  const usage = data.usage ?? { input_tokens: 0, output_tokens: 0 };
  return { text, usage };
}

// ─── Roll the scorecard forward chunk by chunk (simulates the ~90s live ticks) ──
async function runRolling(model, chunks) {
  let summary = "";
  let inTok = 0, outTok = 0;
  const t0 = Date.now();

  for (let i = 0; i < chunks.length; i++) {
    const { text, usage } = await callModel(model, summary, chunks[i]);
    summary = text;
    inTok += usage.input_tokens || 0;
    outTok += usage.output_tokens || 0;
    if (VERBOSE) {
      console.log(`\n────── ${model} · after chunk ${i + 1}/${chunks.length} ──────`);
      console.log(summary);
    }
  }

  const rate = RATES[model] ?? { in: 0, out: 0 };
  const cost = (inTok / 1e6) * rate.in + (outTok / 1e6) * rate.out;
  return { summary, inTok, outTok, cost, ms: Date.now() - t0, updates: chunks.length };
}

function chunkTranscript(text, linesPerChunk) {
  const lines = text.split("\n").filter((l) => l.trim());
  const chunks = [];
  for (let i = 0; i < lines.length; i += linesPerChunk) {
    chunks.push(lines.slice(i, i + linesPerChunk).join("\n"));
  }
  return chunks;
}

// ─── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const transcript = filePath
    ? fs.readFileSync(path.resolve(filePath), "utf-8")
    : MOCK_TRANSCRIPT;

  const source = filePath ? path.resolve(filePath) : "(built-in mock transcript)";
  const chunks = chunkTranscript(transcript, LINES_PER_CHUNK);

  console.log("═".repeat(72));
  console.log("  BELIEF LADDER SUMMARIZER — offline quality test");
  console.log(`  Transcript: ${source}`);
  console.log(`  Simulating ${chunks.length} live updates (${LINES_PER_CHUNK} lines/tick)`);
  console.log(`  Models: Haiku${HAIKU_ONLY ? " only" : " vs Sonnet (side-by-side)"}`);
  console.log("═".repeat(72));

  // Run Haiku and Sonnet in parallel (each rolls internally, sequentially)
  const jobs = [runRolling(HAIKU, chunks)];
  if (!HAIKU_ONLY) jobs.push(runRolling(SONNET, chunks));
  const [haiku, sonnet] = await Promise.all(jobs);

  const printResult = (label, r) => {
    console.log("\n" + "═".repeat(72));
    console.log(`  ========== ${label} ==========`);
    console.log("═".repeat(72));
    console.log(r.summary);
    console.log("─".repeat(72));
    console.log(
      `  ${r.updates} updates · ${r.inTok} in / ${r.outTok} out tokens · ` +
      `~$${r.cost.toFixed(4)} for this call (APPROX rates — confirm) · ${(r.ms / 1000).toFixed(1)}s total`
    );
  };

  printResult("HAIKU", haiku);
  if (!HAIKU_ONLY) printResult("SONNET", sonnet);

  console.log("\n" + "═".repeat(72));
  console.log("  JUDGE THE SCORECARD(S) ON:");
  console.log("   • Right pain identified?");
  console.log("   • Honest belief statuses (no inflation — prospect-confirmed = ✅, rep-framed = 🟡)?");
  console.log("   • Quotes are VERBATIM + actually useful for tie-downs?");
  console.log("   • Correct WEAKEST LINK?");
  console.log("   • Stayed consistent + fixed-size across the whole call?");
  console.log("   • ZERO hallucinated facts?");
  if (!HAIKU_ONLY) console.log("   • Is Sonnet's judgment visibly better — enough to justify ~3× cost?");
  console.log("═".repeat(72));
}

main().catch((err) => {
  console.error("\n❌ Test failed:", err.message);
  process.exit(1);
});
