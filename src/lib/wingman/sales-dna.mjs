/**
 * sales-dna.mjs — SINGLE SOURCE OF TRUTH for the Sales DNA offer-context block.
 *
 * Phase 1b of the Offer-Aware Wingman moat (design: Wingman Brain/07 - North Star/
 * Sales DNA Capture — Design.md). The rep fills the Sales DNA page once; this module
 * turns that saved blob into the ONE canonical text block every consumer injects:
 *
 *   - src/lib/wingman/dig-prompt.mjs        → dig card user segments (cached prefix)
 *   - src/app/api/wingman/summarize/route.ts → Belief Ladder summarizer system block
 *   - src/lib/wingman/pipeline-warmup.ts     → warm-at-deploy cache priming
 *   - src/app/api/profile/update/route.ts    → save-path sanitizer
 *   - scripts/dig-eval.mjs + scripts/test-belief-ladder.mjs → the eval gates
 *
 * It is .mjs (not .ts) for the same anti-drift reason as dig-prompt.mjs: the eval
 * harnesses are plain Node and can't import .ts. One builder, imported by production
 * AND the gates, means the tests always grade exactly the bytes that ship.
 *
 * BYTE-STABILITY IS LOAD-BEARING: the Anthropic prompt cache keys on the exact byte
 * prefix. The warm-at-deploy prime, every dig press, and every summarize tick must
 * produce IDENTICAL block text for the same saved DNA, or the cache silently misses
 * and we pay full price per request. Hence: fixed field order, fixed labels, one
 * sanitizer, no timestamps, no randomness. Do not "tidy" the output format casually —
 * any byte change invalidates in-flight caches (harmless once, expensive as a habit).
 *
 * FRAMING IS LOAD-BEARING TOO (Sebastian, 2026-07-11): the Sales DNA describes the
 * AVERAGE prospect for this offer — context, never gospel, never what THIS prospect
 * said. The anti-fabrication header ships inside the block itself so no consumer can
 * inject the facts without the fence. Zero fabrication is the bar.
 */

// ── The questionnaire — every key the Sales DNA page captures ──────────────────
// Order is FIXED (byte-stability). Mirrors the SalesDna type in src/types/index.ts
// and SALES_DNA_KEYS in the profile-update sanitizer (both import from here).
export const SALES_DNA_QUESTIONS = [
  "transformation", // Q1 — what you sell + before→after
  "root_driver",    // Q2 ⭐ the one thing every client is chasing
  "emotional_root", // Q3 — what they're really after underneath
  "guarantee",      // guarantee / risk-reversal ("we don't offer one" counts as answered)
  "syntax",         // Q4 — open on problems or goals ("unsure" counts as answered)
  "pain",           // Q5
  "desire",         // Q6 ⭐ goal phrasings + what they chunk down to
  "cost",           // Q7 — costs of staying stuck
  "doubt",          // Q8 — why they can't DIY
  "trust",          // Q9 — why this way is different
  "money",          // Q10 — how the rep qualifies affordability
  "support",        // Q11 — who else decides
];

// Size caps — shared with the profile-update save path so what we accept at save
// time and what we inject at call time can never disagree.
export const SALES_DNA_FIELD_MAX = 2000;  // per-field char cap
// Total must sit ABOVE a full brain-dump's natural ceiling (12 × 2000 = 24,000) so
// legitimate heavy input is never dropped — this only guards true abuse.
export const SALES_DNA_TOTAL_MAX = 26000; // serialized blob char cap

const VALID_SYNTAX = new Set(["problems", "goals", "unsure"]);

/**
 * Coerce an untrusted sales_dna value into a safe plain object.
 * Plain object only, known string keys only, per-field + total size capped.
 * Returns null when the input is unusable (caller drops it) — never throws.
 * Single sanitizer for the save path (profile/update) AND every call-time rail
 * (summarize body, press payload, session-create) — one set of caps, zero drift.
 *
 * @param {unknown} v
 * @returns {Record<string, string> | null}
 */
export function sanitizeSalesDna(v) {
  if (v === null) return {};                                  // explicit reset
  if (typeof v !== "object" || Array.isArray(v)) return null; // not a blob → drop
  const out = {};
  // Iterate OUR fixed key order (not the object's) so output key order — and the
  // block text built from it — is byte-stable regardless of client JSON ordering.
  for (const k of SALES_DNA_QUESTIONS) {
    const val = /** @type {Record<string, unknown>} */ (v)[k];
    if (val == null) continue;             // skip empties (leave key unset)
    if (typeof val !== "string") continue; // strings only (syntax is a string)
    const trimmed = val.slice(0, SALES_DNA_FIELD_MAX);
    if (trimmed.trim()) out[k] = trimmed;
  }
  if (JSON.stringify(out).length > SALES_DNA_TOTAL_MAX) return null; // oversized → drop
  return out;
}

/**
 * Which questions are still unanswered. "Answered" means ADDRESSED, not "has a
 * guarantee": the UI offers an explicit "we don't offer one" answer for guarantee,
 * and syntax "unsure" is a legitimate answer — both count. (Sebastian, 2026-07-11:
 * the gate is EVERY question, and the same rule powers the 1c Deploy gate.)
 *
 * @param {unknown} dna
 * @returns {string[]} unanswered question keys ([] when complete)
 */
export function salesDnaMissing(dna) {
  const clean = sanitizeSalesDna(dna);
  if (clean === null) return [...SALES_DNA_QUESTIONS];
  return SALES_DNA_QUESTIONS.filter((k) => {
    const v = (clean[k] ?? "").trim();
    if (!v) return true;
    if (k === "syntax") return !VALID_SYNTAX.has(v); // must be a real option
    return false;
  });
}

/**
 * True when every Sales DNA question has been addressed.
 * The 1b inject threshold AND the 1c Deploy gate — one definition of "briefed".
 * @param {unknown} dna
 */
export function isSalesDnaComplete(dna) {
  return salesDnaMissing(dna).length === 0;
}

// syntax value → the phrase the block prints (fixed mapping, byte-stable)
const SYNTAX_LABEL = {
  problems: "their problems first",
  goals: "their goals first",
  unsure: "varies call to call",
};

/**
 * Build the canonical Sales DNA context block, or null when the DNA is incomplete.
 *
 * ALL-OR-NOTHING (Sebastian, 2026-07-11): a lone field skews a card worse than no
 * context at all — half a picture misleads more than no picture. Below the
 * all-questions threshold this returns null and every consumer stays fully generic
 * (byte-identical to the pre-1b prompts — zero regression for un-briefed reps).
 *
 * TOTAL FUNCTION: any input shape (undefined, null, garbage, oversized) returns
 * a string or null — never throws. This sits on the live press path.
 *
 * The AVERAGES-NOT-GOSPEL fence ships inside the block so no consumer can inject
 * the facts without it.
 *
 * @param {unknown} dna — the raw sales_dna blob (untrusted OK; sanitized here)
 * @returns {string | null}
 */
export function buildSalesDnaBlock(dna) {
  const clean = sanitizeSalesDna(dna);
  if (clean === null || !isSalesDnaComplete(clean)) return null;

  const f = (k) => clean[k].trim();
  const syntaxPhrase = SYNTAX_LABEL[f("syntax")] ?? "varies call to call";

  return `REP'S SALES DNA — offer context the rep saved BEFORE any call:
⚠️ AVERAGES, NOT GOSPEL: this describes the rep's offer and the AVERAGE prospect for it. The person on THIS call has said NONE of it unless the transcript shows it. Never present, assume, or record any detail below as something THIS prospect said, feels, has, or agreed to.

THE OFFER
- What they sell + the transformation: ${f("transformation")}
- The ONE thing every client is really chasing (the root driver): ${f("root_driver")}
- What clients are really after underneath the numbers: ${f("emotional_root")}
- Guarantee / risk-reversal: ${f("guarantee")}

HOW THE AVERAGE PROSPECT SHOWS UP (the rep's own discovery notes)
- The rep opens discovery on: ${syntaxPhrase}
- Typical pain they arrive with: ${f("pain")}
- How they usually voice the goal — and what it really comes down to: ${f("desire")}
- Typical costs of staying stuck: ${f("cost")}
- Why they can't fix it alone / what they've usually tried: ${f("doubt")}
- Why this offer is different from what burned them before: ${f("trust")}
- How the rep qualifies money: ${f("money")}
- Who else is usually in the decision: ${f("support")}`;
}

/**
 * The summarizer-side system block: the canonical block + the interpretive-lens
 * rules the Belief Ladder must follow. Appended to BELIEF_LADDER_SYSTEM_PROMPT as
 * the SECOND system text block (the cache breakpoint sits on it — stable all call,
 * so the ~2-min summarize tick keeps the cache warm for free).
 *
 * Lives here (not in the route) so scripts/test-belief-ladder.mjs injects the
 * EXACT bytes production ships — the fabrication traps grade what's real.
 *
 * @param {unknown} dna
 * @returns {string | null} null when the DNA is incomplete (route falls back to
 *   the legacy single-block system — byte-identical to pre-1b)
 */
export function buildSummarizerDnaSystemBlock(dna) {
  const block = buildSalesDnaBlock(dna);
  if (!block) return null;

  return `${block}

HOW TO USE THE SALES DNA (interpretive lens ONLY — read carefully):
- It tells you how the AVERAGE prospect for this offer talks, so you can RECOGNIZE what THIS prospect's words point at. Example: if the rep's average prospect says "quit my job" and it really comes down to a monthly cash-flow number, then when THIS prospect says "quit my job" you know which belief that speech points at (Desire) and what a sharp rep will chunk it down to.
- It NEVER supplies evidence. Every belief grade (✅ 🟡 ⬜ ⚠️), every number, every quote in the scorecard must come from THIS call's transcript alone. NEVER mark a belief ✅ or 🟡 because the Sales DNA says the average prospect has that pain or goal.
- NEVER copy a number, pain, goal, quote, or fact from the Sales DNA into the scorecard as if the prospect said it. If it isn't in the transcript, it does not exist on this call.
- If the Sales DNA and the transcript disagree, the transcript wins — grade THIS prospect, not the average one.`;
}
