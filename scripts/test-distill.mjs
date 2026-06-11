/**
 * scripts/test-distill.mjs — OFFLINE harness for the Phase 3.5 query distiller.
 *
 * The distiller is the quality gate + retrieval fix for the ↑ objection slot:
 * a small fast Groq model reads the last ~120s of transcript and extracts ONE
 * short first-person objection phrase (or null). That phrase — not the raw
 * buffer — is what gets embedded and searched against kb_prospect_triggers.
 *
 * Two gates (see scripts/test-transcripts/EXPECTED-DISTILL.md, pre-registered):
 *   (a) EXTRACTION — 5/5 on the answer key (incl. the 03 NONE reverse trap and
 *       the 05 hidden-objection judgment test).
 *   (b) RETRIEVAL  — distilled-phrase KB search must match or beat raw-tail
 *       search on top-match similarity (justifies the ~300ms serial hop).
 *
 * USAGE:
 *   node scripts/test-distill.mjs                # extraction gate only (Groq, ~free)
 *   node scripts/test-distill.mjs --retrieval    # + KB comparison (OpenAI embed + Supabase RPC)
 *   node scripts/test-distill.mjs --verbose      # print the raw window per case
 *
 * NOTE: this is the TUNING SANDBOX. Once locked, DISTILL_SYSTEM_PROMPT is lifted
 * verbatim into src/lib/wingman/query-distill.ts. One source of truth.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Load .env.local (same loader as test-belief-ladder.mjs) ───────────────────
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

const GROQ_KEY = process.env.GROQ_API_KEY;
if (!GROQ_KEY) {
  console.error("❌ GROQ_API_KEY not found in .env.local — cannot run.");
  process.exit(1);
}

const args      = process.argv.slice(2);
const RETRIEVAL = args.includes("--retrieval");
const VERBOSE   = args.includes("--verbose");

// ─── Window size: the live rolling buffer is ~120s ≈ last 12 transcript lines ──
const WINDOW_LINES = 12;

// ════════════════════════════════════════════════════════════════════════════════
// THE #1 ARTIFACT — the distiller system prompt. Tune THIS. Everything else is wiring.
// Lifted verbatim into src/lib/wingman/query-distill.ts once locked.
// ════════════════════════════════════════════════════════════════════════════════
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

// ─── Groq distill call (mirrors the future query-distill.ts exactly) ───────────
async function distill(windowText) {
  const t0 = Date.now();
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      temperature: 0,
      max_tokens: 100,                              // headroom — a truncated JSON is a parse failure
      response_format: { type: "json_object" },     // Groq guaranteed-JSON mode
      messages: [
        { role: "system", content: DISTILL_SYSTEM_PROMPT },
        { role: "user", content: `LAST ~2 MINUTES OF THE CALL:\n${windowText}` },
      ],
    }),
  });
  const ms = Date.now() - t0;
  if (!resp.ok) throw new Error(`Groq ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const raw  = (data.choices?.[0]?.message?.content ?? "").trim();
  // Defensive parse — strip code fences, find the JSON object
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { objection: undefined, parseError: raw, ms };
  }
  return { objection: parsed.objection ?? null, ms };
}

// ─── Answer key (mechanical mirror of EXPECTED-DISTILL.md) ─────────────────────
const CASES = [
  {
    file: "01-fake-yes.txt",
    expectNone: false,
    mustAny:  ["dev", "partner", "circle back", "loop"],
    mustNot:  [],
    label: "stall behind the partner (Dev)",
  },
  {
    file: "02-guarded-skeptic.txt",
    expectNone: false,
    mustAny:  ["five grand", "5", "what", "send me", "info", "think about it"],
    mustNot:  [],
    label: "price/value skepticism + send-me-info brush-off",
  },
  {
    file: "03-strong-close.txt",
    expectNone: true,
    mustAny:  [],
    mustNot:  [],
    label: "REVERSE TRAP — no objection exists (must return null)",
  },
  {
    file: "04-contradiction-longcall.txt",
    expectNone: false,
    mustAny:  ["husband", "him in the room", "together"],
    mustNot:  [],
    label: "spouse sign-off gate",
  },
  {
    file: "05-hidden-objection.txt",
    expectNone: false,
    mustAny:  ["follow through", "follow-through", "scared", "it's me", "myself", "finish"],
    mustNot:  ["refund", "price"],
    label: "JUDGMENT TEST — fear of failure, not logistics/refund/money",
  },
];

function grade(c, objection) {
  if (c.expectNone) {
    return objection === null
      ? { pass: true,  why: "correctly returned null" }
      : { pass: false, why: `extracted "${objection}" but NONE was expected` };
  }
  if (objection === null || objection === undefined) {
    return { pass: false, why: "returned null but a real objection exists" };
  }
  const lower = objection.toLowerCase();
  const hit   = c.mustAny.some((m) => lower.includes(m));
  const bad   = c.mustNot.find((m) => lower.includes(m));
  if (bad)  return { pass: false, why: `centers on forbidden topic "${bad}"` };
  if (!hit) return { pass: false, why: `missing all required mentions (${c.mustAny.join(" | ")})` };
  return { pass: true, why: "matched answer key" };
}

// ─── Retrieval comparison: distilled phrase vs raw tail against the live KB ────
async function embed(text) {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });
  if (!resp.ok) throw new Error(`OpenAI embed ${resp.status}: ${await resp.text()}`);
  return (await resp.json()).data[0].embedding;
}

// Thresholds: the DISTILLED query is short + objection-shaped (same shape as the KB
// triggers), and it only exists when Groq confirmed a real objection — so 0.60+ scores
// on it are honest semantic matches, not smoothie noise. Probes (2026-06-11): real
// matches land 0.617–0.653, noise at ≤0.509 → 0.60 separates cleanly. The RAW path
// keeps production's 0.65 (it still embeds a whole 120s buffer).
const DISTILLED_THRESHOLD = 0.60;
const RAW_THRESHOLD       = 0.65;

async function kbSearch(embedding, threshold) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/search_kb_by_trigger`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query_embedding:      embedding,
      similarity_threshold: threshold,
      match_count:          3,
    }),
  });
  if (!resp.ok) throw new Error(`Supabase RPC ${resp.status}: ${await resp.text()}`);
  return await resp.json();
}

function fmtMatches(matches, threshold) {
  if (!matches.length) return `    (no matches above ${threshold})`;
  return matches
    .map((m) => `    ${m.similarity.toFixed(3)}  ${m.technique_name}  [via: "${m.matched_trigger}"]`)
    .join("\n");
}

// ─── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═".repeat(72));
  console.log("  QUERY DISTILLER — offline gate (Phase 3.5)");
  console.log(`  Model: llama-3.1-8b-instant · window: last ${WINDOW_LINES} lines (~120s)`);
  console.log(`  Retrieval comparison: ${RETRIEVAL ? "ON" : "off (--retrieval to enable)"}`);
  console.log("═".repeat(72));

  if (RETRIEVAL && (!process.env.OPENAI_API_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.error("❌ --retrieval needs OPENAI_API_KEY + NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  let passed = 0;
  const retrievalRows = [];

  for (const c of CASES) {
    const full   = fs.readFileSync(path.join(__dirname, "test-transcripts", c.file), "utf-8");
    const lines  = full.split("\n").filter((l) => l.trim());
    const window = lines.slice(-WINDOW_LINES).join("\n");

    const { objection, parseError, ms } = await distill(window);
    const g = parseError
      ? { pass: false, why: `JSON parse failed — raw: ${parseError.slice(0, 120)}` }
      : grade(c, objection);

    if (g.pass) passed++;
    console.log(`\n${g.pass ? "✅ PASS" : "❌ FAIL"}  ${c.file} — ${c.label}  (${ms}ms)`);
    console.log(`   extracted: ${objection === null ? "(none)" : JSON.stringify(objection)}`);
    console.log(`   verdict:   ${g.why}`);
    if (VERBOSE) console.log(`   window:\n${window.split("\n").map((l) => "     | " + l).join("\n")}`);

    // Retrieval comparison only where a real objection exists AND extraction passed
    if (RETRIEVAL && !c.expectNone && g.pass && objection) {
      const [dEmb, rEmb]   = await Promise.all([embed(objection), embed(window)]);
      const [dHits, rHits] = await Promise.all([kbSearch(dEmb, DISTILLED_THRESHOLD), kbSearch(rEmb, RAW_THRESHOLD)]);
      const dTop = dHits[0]?.similarity ?? 0;
      const rTop = rHits[0]?.similarity ?? 0;
      retrievalRows.push({ file: c.file, dTop, rTop, win: dTop >= rTop || (dTop > 0 && rTop === 0) });
      console.log(`   ── retrieval ──`);
      console.log(`   DISTILLED query top matches:\n${fmtMatches(dHits, DISTILLED_THRESHOLD)}`);
      console.log(`   RAW-TAIL  query top matches:\n${fmtMatches(rHits, RAW_THRESHOLD)}`);
    }
  }

  console.log("\n" + "═".repeat(72));
  console.log(`  EXTRACTION GATE: ${passed}/${CASES.length} ${passed === CASES.length ? "— PASS ✅" : "— FAIL ❌ (tune DISTILL_SYSTEM_PROMPT and re-run)"}`);
  if (RETRIEVAL && retrievalRows.length) {
    const wins = retrievalRows.filter((r) => r.win).length;
    for (const r of retrievalRows) {
      console.log(`  ${r.win ? "✅" : "❌"} ${r.file}: distilled top ${r.dTop.toFixed(3)} vs raw top ${r.rTop.toFixed(3)}`);
    }
    console.log(`  RETRIEVAL GATE: distilled ≥ raw in ${wins}/${retrievalRows.length} — ${wins === retrievalRows.length ? "PASS ✅" : "review before proceeding"}`);
  }
  console.log("═".repeat(72));

  if (passed !== CASES.length) process.exit(1);
}

main().catch((err) => {
  console.error("\n❌ Harness failed:", err.message);
  process.exit(1);
});
