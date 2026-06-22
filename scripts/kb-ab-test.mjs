/**
 * kb-ab-test.mjs — Blind A/B harness: does the Knowledge Base earn its place?
 *
 *   node scripts/kb-ab-test.mjs
 *
 * For each objection in kb-ab-corpus.mjs it generates FOUR signal cards from the
 * SAME context (transcript). The only thing that differs between arms is the
 * prompt / whether the KB is used:
 *
 *   A — KB           : real path. Distill objection (Groq) → search KB
 *                      (search_kb_by_trigger RPC @ 0.60) → Haiku card forced to
 *                      compress the retrieved script. (KB miss → grounded fallback.)
 *   B — Free         : no KB. Haiku reasons, grounded in the objection (the real
 *                      generateFallbackCard prompt).
 *   C — Like Miner   : no KB. "Handle it the way Jeremy Miner (NEPQ) would."
 *   D — Like Gordon  : no KB. "Handle it the way Cole Gordon would."
 *
 * Same model (claude-haiku-4-5-20251001), same token budget, same system prompt —
 * the prompts below are copied VERBATIM from the live source so the cards match
 * production. Live code is NOT touched.
 *
 * Outputs to tasks/kb-ab-test/:
 *   - grading-sheet.md  : BLIND. 4 cards per objection in randomized order, no
 *                         labels, no KB info, no source. You pick the best of 4.
 *   - answer-key.json   : the card→arm mapping + KB hit/entry/similarity + latency.
 *   - raw-results.json  : full dump of everything for the reveal.
 *
 * Read-only against Supabase (search RPC only). Costs a few cents of API calls.
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { SCENARIOS } from "./kb-ab-corpus.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = join(__dirname, "../tasks/kb-ab-test");

// ── minimal .env.local loader (mirrors test-kb-memory-parity.mjs) ────────────
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

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY    = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GROQ_KEY      = process.env.GROQ_API_KEY;
for (const [k, v] of Object.entries({ SUPABASE_URL, SERVICE_KEY, OPENAI_KEY, ANTHROPIC_KEY })) {
  if (!v) { console.error(`Missing required env: ${k}`); process.exit(1); }
}
if (!GROQ_KEY) console.warn("⚠️  GROQ_API_KEY not set — distillation will degrade to the raw objection line (same as a Groq outage).\n");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const HAIKU_MODEL   = "claude-haiku-4-5-20251001";
const DISTILL_MODEL = "llama-3.1-8b-instant";
const KB_THRESHOLD  = 0.60;   // DISTILLED_SIMILARITY_THRESHOLD (kb-signal/route.ts)
const MATCH_COUNT   = 5;

// ─────────────────────────────────────────────────────────────────────────────
// VERBATIM prompt copies from the live source (keep in sync; this is a test).
// ─────────────────────────────────────────────────────────────────────────────

// query-distill.ts → DISTILL_SYSTEM_PROMPT
const DISTILL_SYSTEM_PROMPT = `You extract the prospect's CURRENT objection from the last ~2 minutes of a live sales call.

An objection is ANY pushback, hesitation, concern, doubt, stall, or deflection from the PROSPECT — about price, value, timing, trust, a partner/spouse who must approve, fear of failing, "send me info," "let me think about it," "let me check with X," etc. Err toward extraction: a soft stall counts.

Rules:
- Output the objection still STANDING at the end of the window. A concern the prospect already moved past (accepted the reframe, agreed, resolved it themselves) is DEAD — never extract it.
- If several concerns are still standing, pick the DEEPEST one (fear/self-doubt, approval, money, trust) — but a request for materials, case studies, logistics or scheduling is NEVER the objection when a real concern is standing.
- If the prospect hides behind surface questions (logistics, refund policy) but then voices the real concern underneath, extract the REAL concern — not the surface question.
- Write it in FIRST PERSON, stated PLAINLY — the way a prospect would say it head-on (like: "I need to talk to my husband first" / "this is too expensive" / "I'm not ready to commit"). Keep the prospect's own distinctive words only when the emotion itself is the objection (scared, burned, overwhelmed). HARD LIMIT: 15 words.
- If the concern is a spouse/partner/boss who must approve, ALWAYS phrase it exactly as: "I need to talk to my <person> first" — drop everything else.
- Only use what was ACTUALLY SAID. Never invent or embellish.
- The REP raising a topic is not an objection. Only the prospect's own resistance counts.
- If the prospect shows genuine commitment with no live hesitation (clear yes, money ready, no stall), there is NO objection.

Examples:
Prospect said: "Honestly the price scared me at first, but the ROI makes sense now. Could you email me the syllabus? I'd also need to run it by my wife — we handle money together."
→ {"objection": "I need to run it by my wife before deciding"}   (price concern was resolved; syllabus is materials; the wife gate is what's standing)
Prospect said: "What stack do you use? Is support included? ...Truthfully I got burned by an agency last year, so I'm cautious about trusting another one."
→ {"objection": "I got burned before and I'm scared to trust another agency"}   (the logistics questions were cover; the trust fear is the real concern)

Respond with JSON only, no other text:
{"objection": "<the phrase, max 15 words>"}  or  {"objection": null}`;

// knowledge-signal.ts → SIGNAL_CARD_SYSTEM_PROMPT (shared by all card arms)
const SIGNAL_CARD_SYSTEM_PROMPT = `You are Wingman — a real-time AI sales coach for high-ticket phone closers.
Your job is to surface the single most important thing the rep should do RIGHT NOW.
You speak to the rep, not the prospect. The rep sees your card on screen.

Rules:
- One clear directive. Not a suggestion — an instruction.
- HEADLINE: 5 words maximum. Must be fully actionable on its own. The rep reads this in a single glance while the prospect is talking — it must work alone.
- SUBTEXT: One sentence only. An example question or framing the rep can use. Write this for when the rep has a natural pause before responding.
- Use the prospect's exact words when referencing their pain or hesitation.
- Do NOT tell the rep to "consider" anything. Tell them what to do.
- Do NOT sound like a training manual. Sound like their inner voice.
- NEVER use the words "belief", "Belief Ladder", "pillar", "scorecard", or any internal framework or coaching-system name in the headline or subtext. The rep must never see the machinery — plain closer language only.
- When a SCRIPT is provided in the knowledge base technique, base your headline directly on that script — compress it to ≤5 words that capture its core directive. Do NOT invent an alternative approach if a script is provided.
- The "Why it works" field gives you the psychological principle — use it to write a more precise subtext, not to replace the script.

Card format — ALWAYS two-tier (the rep summoned this card on purpose and needs the line):
- HEADLINE: ≤5 words, fully actionable on its own.
- SUBTEXT: one sentence the rep can say out loud. Never leave it empty.

Return JSON only — no markdown, no explanation, no preamble:
{
  "headline": "≤5 words. Actionable alone. The thing to do right now.",
  "subtext": "One sentence the rep can say out loud. Always provide it.",
  "source": "The KB technique or principle this is based on."
}`;

// knowledge-signal.ts → SLOT_DIRECTIVES.objection (used by arm B)
const OBJECTION_SLOT_DIRECTIVE =
  "The rep needs to handle an objection or resistance. Surface a NEPQ reframe that reopens the pain — not a rebuttal.";

// Arm C / D — the "handle it like <expert>" directive. Concise, fair style anchors
// (this is the shippable version of Sebastian's idea: one short instruction, no KB).
const EXPERTS = {
  C: {
    name: "Jeremy Miner",
    hint: "Jeremy Miner's NEPQ style: calm, low-pressure, genuinely curious tone. Do NOT rebut or pitch — respond to the objection with a soft, disarming question that makes the prospect reflect and reopen their own pain or reasoning. Use their exact words.",
  },
  D: {
    name: "Cole Gordon",
    hint: "Cole Gordon's style: keep control of the frame. Calmly isolate whether this is the real objection, then reframe it around the cost of NOT solving the problem and the specific outcome the prospect said they want. Direct and assumptive, never pushy.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────────────────────────────────────

async function embed(text) {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method:  "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });
  if (!resp.ok) throw new Error(`OpenAI embed ${resp.status}: ${await resp.text()}`);
  return (await resp.json()).data[0].embedding;
}

// Mirrors query-distill.ts distillObjection → returns { found:true, phrase } |
// { found:false } | null (Groq down/timeout → caller falls back to the raw line).
async function distill(transcript) {
  if (!GROQ_KEY) return null;
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 1_500);
  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:  "POST",
      headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model:           DISTILL_MODEL,
        temperature:     0,
        max_tokens:      100,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: DISTILL_SYSTEM_PROMPT },
          { role: "user",   content: `LAST ~2 MINUTES OF THE CALL:\n${transcript}` },
        ],
      }),
      signal: controller.signal,
    });
    if (!resp.ok) { console.error("[distill] Groq", resp.status); return null; }
    const raw = (await resp.json()).choices?.[0]?.message?.content ?? "";
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!("objection" in parsed)) return null;
    if (parsed.objection === null) return { found: false };
    if (typeof parsed.objection === "string" && parsed.objection.trim()) {
      return { found: true, phrase: parsed.objection.trim().slice(0, 160) };
    }
    return null;
  } catch (err) {
    if (err?.name !== "AbortError") console.error("[distill]", err?.message ?? err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// search_kb_by_trigger RPC — same call the live fallback uses; returns full entry
// rows WITH similarity. In-memory primary is parity-verified identical (14/14), so
// these are the entries production retrieves.
async function searchKb(queryEmbedding, threshold) {
  const { data, error } = await supabase.rpc("search_kb_by_trigger", {
    query_embedding:      queryEmbedding,
    similarity_threshold: threshold,
    match_count:          MATCH_COUNT,
  });
  if (error) throw error;
  return data ?? [];
}

// knowledge-search.ts result formatting (top 3)
function formatKnowledge(matches) {
  const top3 = matches.slice(0, 3);
  return [
    "RELEVANT SALES TECHNIQUES FROM KNOWLEDGE BASE:",
    ...top3.map((m, i) =>
      `[TECHNIQUE ${i + 1}]\nName: ${m.technique_name}\nStage: ${m.call_stage}\nWhen to use: ${m.situation}\nScript: ${m.exact_script}\nWhy it works: ${m.why_it_works}`,
    ),
  ].join("\n\n");
}

// Shared Haiku call — same model + budget as both live generators. Returns
// { headline, subtext, source } or { error }.
async function haikuCard(userMessage) {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 12_000);
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "x-api-key":         ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      HAIKU_MODEL,
        max_tokens: 150,
        system:     SIGNAL_CARD_SYSTEM_PROMPT,
        messages:   [{ role: "user", content: userMessage }],
      }),
      signal: controller.signal,
    });
    if (!resp.ok) return { error: `Haiku ${resp.status}: ${(await resp.text()).slice(0, 120)}` };
    const raw = (await resp.json()).content?.[0]?.text?.trim() ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.headline) return { error: "no headline" };
    return { headline: parsed.headline, subtext: parsed.subtext ?? "", source: parsed.source ?? "" };
  } catch (err) {
    return { error: err?.name === "AbortError" ? "timeout" : (err?.message ?? String(err)) };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Production feeds the live Belief Ladder summary to the card generators. Build the
// same block here from the scenario's discovery context — IDENTICAL for every arm,
// so it can't bias A vs B/C/D. It just gives all four the anchors a real call has.
function contextBlock(context) {
  return context
    ? `\n\nLIVE CALL CONTEXT (Belief Ladder — Weakest Link, verbatim quotes, 7 beliefs):\n${context}`
    : "\nActive sales call.";
}

// Arm A — KB card (knowledge-signal.ts generateSignalCard user message)
function kbUserMessage(knowledgeResults, transcript, ctx) {
  return `KNOWLEDGE BASE TECHNIQUE:\n${knowledgeResults}\n\n` +
         `WHAT THE PROSPECT JUST SAID (last ~120 s):\n${transcript}` +
         contextBlock(ctx);
}

// Arm B — free reasoning (generateFallbackCard user message)
function fallbackUserMessage(grounding, transcript, ctx) {
  const objectionLine = `\nTHE PROSPECT'S CURRENT OBJECTION (extracted from the call): "${grounding}"\nYour card must handle THIS objection — nothing else.\n`;
  return `SITUATION:\n${OBJECTION_SLOT_DIRECTIVE}\n${objectionLine}\n` +
         `WHAT THE PROSPECT JUST SAID (last ~120 s):\n${transcript}` +
         contextBlock(ctx);
}

// Arms C/D — "handle it like <expert>" (mirrors fallback scaffolding, swaps directive)
function expertUserMessage(expert, grounding, transcript, ctx) {
  const directive = `Handle this objection the way ${expert.name} would. ${expert.hint}`;
  const objectionLine = `\nTHE PROSPECT'S CURRENT OBJECTION (extracted from the call): "${grounding}"\nYour card must handle THIS objection — nothing else.\n`;
  return `SITUATION:\n${directive}\n${objectionLine}\n` +
         `WHAT THE PROSPECT JUST SAID (last ~120 s):\n${transcript}` +
         contextBlock(ctx);
}

async function timed(fn) {
  const t0 = Date.now();
  const card = await fn();
  return { ...card, ms: Date.now() - t0 };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────

async function runScenario(s) {
  // 1. Distill (real KB path) → grounding for every arm.
  const distilled = await distill(s.transcript);
  const grounding = distilled?.found ? distilled.phrase : s.objection;

  // 2. KB retrieval for arm A.
  const queryEmbedding = await embed(grounding);
  const matches  = await searchKb(queryEmbedding, KB_THRESHOLD);
  const kbHit    = matches.length > 0;
  const kbString = kbHit ? formatKnowledge(matches) : null;

  // 3. Four arms, same context, in parallel.
  const [A, B, C, D] = await Promise.all([
    timed(() =>
      kbHit ? haikuCard(kbUserMessage(kbString, s.transcript, s.context))
            : haikuCard(fallbackUserMessage(grounding, s.transcript, s.context)), // KB miss → grounded fallback (real behavior)
    ),
    timed(() => haikuCard(fallbackUserMessage(grounding, s.transcript, s.context))),
    timed(() => haikuCard(expertUserMessage(EXPERTS.C, grounding, s.transcript, s.context))),
    timed(() => haikuCard(expertUserMessage(EXPERTS.D, grounding, s.transcript, s.context))),
  ]);

  const arms = {
    A: { ...A, kind: kbHit ? "kb" : "kb-miss→fallback" },
    B: { ...B, kind: "free" },
    C: { ...C, kind: "like-miner" },
    D: { ...D, kind: "like-gordon" },
  };

  // 4. Blind order for the grading sheet.
  const order = shuffle(["A", "B", "C", "D"]);

  return {
    id: s.id,
    category: s.category,
    objection: s.objection,
    context: s.context,
    transcript: s.transcript,
    distilled,
    grounding,
    kbHit,
    kbEntries: matches.map((m) => ({
      technique_name: m.technique_name,
      similarity:     m.similarity,
      call_stage:     m.call_stage,
      situation:      m.situation,
      exact_script:   m.exact_script,
      why_it_works:   m.why_it_works,
      matched_trigger: m.matched_trigger,
    })),
    arms,
    order,
  };
}

function buildGradingSheet(results) {
  const lines = [];
  lines.push("# KB A/B — Blind Grading Sheet");
  lines.push("");
  lines.push("For each objection you'll see the call setup, then **4 cards in random order** (no labels).");
  lines.push("Pick the **single best card** — the one you'd most want on screen at that moment.");
  lines.push("");
  lines.push("**How to answer:** reply with one line per objection, e.g. `1:3` (objection 1, card 3).");
  lines.push("All on one line is fine: `1:3 2:1 3:4 ...`. If two are basically tied, pick either. If all 4 are bad, write `x`.");
  lines.push("");
  lines.push("Don't overthink it — go with your gut as a closer. ~15 min.");
  lines.push("");
  lines.push("---");
  for (const r of results) {
    lines.push("");
    lines.push(`### Objection ${r.id} — "${r.objection}"`);
    lines.push("");
    if (r.context) {
      lines.push("**Discovery so far:**");
      lines.push("");
      for (const ln of r.context.split("\n")) lines.push(`> ${ln}`);
      lines.push("");
    }
    lines.push("**Right now:**");
    lines.push("");
    for (const ln of r.transcript.split("\n")) lines.push(`> ${ln}`);
    lines.push("");
    r.order.forEach((armKey, idx) => {
      const card = r.arms[armKey];
      lines.push(`**Card ${idx + 1}**  `);
      if (card.error) {
        lines.push(`_(generation failed: ${card.error})_`);
      } else {
        lines.push(`**${card.headline}**  `);
        lines.push(card.subtext || "_(no subtext)_");
      }
      lines.push("");
    });
    lines.push(`**Your pick for #${r.id}: ____**`);
    lines.push("");
    lines.push("---");
  }
  return lines.join("\n");
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Running ${SCENARIOS.length} objections × 4 arms…\n`);

  const results = [];
  for (const s of SCENARIOS) {
    const r = await runScenario(s);
    results.push(r);
    const fails = Object.values(r.arms).filter((a) => a.error).length;
    console.log(
      `#${String(r.id).padStart(2)} ${r.kbHit ? "KB✓" : "KB✗"}  "${r.objection}"` +
      `  → distilled: ${r.distilled?.found ? `"${r.distilled.phrase}"` : r.distilled === null ? "(groq down→raw)" : "(none→raw)"}` +
      (r.kbHit ? `  top: "${r.kbEntries[0].technique_name}" (${r.kbEntries[0].similarity.toFixed(3)})` : "") +
      (fails ? `  ⚠️ ${fails} arm(s) failed` : ""),
    );
  }

  const kbHits = results.filter((r) => r.kbHit).length;

  // Answer key (card→arm + KB detail + latency) — used by the scorer at reveal.
  const answerKey = results.map((r) => ({
    id: r.id,
    objection: r.objection,
    category: r.category,
    order: r.order, // order[i] = arm shown as Card (i+1)
    kbHit: r.kbHit,
    distilled: r.distilled,
    grounding: r.grounding,
    kbEntries: r.kbEntries,
    latencyMs: Object.fromEntries(Object.entries(r.arms).map(([k, v]) => [k, v.ms])),
  }));

  writeFileSync(join(OUT_DIR, "grading-sheet.md"), buildGradingSheet(results));
  writeFileSync(join(OUT_DIR, "answer-key.json"), JSON.stringify(answerKey, null, 2));
  writeFileSync(join(OUT_DIR, "raw-results.json"), JSON.stringify(results, null, 2));

  console.log(`\nKB fired on ${kbHits}/${results.length} objections.`);
  console.log(`\nWrote:`);
  console.log(`  tasks/kb-ab-test/grading-sheet.md   ← grade this (blind)`);
  console.log(`  tasks/kb-ab-test/answer-key.json    ← scorer reads this (don't peek)`);
  console.log(`  tasks/kb-ab-test/raw-results.json   ← full dump`);
}

main().catch((err) => { console.error(err); process.exit(1); });
