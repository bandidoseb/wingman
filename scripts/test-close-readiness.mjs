/**
 * test-close-readiness.mjs — offline gate for the → Close readiness scoring.
 *
 * Pure, no API calls, no cost. Run:  node scripts/test-close-readiness.mjs
 * Must be GREEN to ship. Grades the EXACT logic that ships (imports the shared .mjs), incl. the
 * plan-review regression guards (false-green, evidence-glyph, legend/quote lines, VS16, dupes).
 */

import { scoreReadiness } from "../src/lib/wingman/close-readiness.mjs";

// Status glyphs. A = at-risk WITH the U+FE0F variation selector (the realistic on-wire form).
const L = "✅", P = "🟡", O = "⬜", A = "⚠️";

/** Build a realistic Belief Ladder block from a per-belief status map (+ optional evidence). */
function ladder({ Pain = O, Doubt = O, Cost = O, Desire = O, Money = O, Support = O, Trust = O, ev = {} } = {}) {
  const line = (n, name, s, id) => `  ${n} ${name}${" ".repeat(Math.max(1, 22 - name.length))}${s} — ${ev[id] ?? "evidence here"}`;
  return `LIVE CALL MEMORY
Stage: Discovery · Elapsed: 22m · Syntax: —
▸ THE GAP
  Current "hell":   doing 8k/mo, wants more
  Desired "heaven": 30k/mo · $GOAL 30000 · why that #: freedom
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ at-risk/objection)
${line(1, "Pain", Pain, "Pain")}
${line(2, "Doubt (can't DIY)", Doubt, "Doubt")}
${line(3, "Cost (of inaction)", Cost, "Cost")}
${line(4, "Desire", Desire, "Desire")}
${line(5, "Money", Money, "Money")}
${line(6, "Support (who decides)", Support, "Support")}
${line(7, "Trust (why you)", Trust, "Trust")}
▸ THEIR EXACT WORDS (verbatim, for tie-downs)
  • "things are really tight right now"
▸ OPEN OBJECTIONS: none
▸ WEAKEST LINK → Pain, Money`;
}

let pass = 0, fail = 0;
const results = [];

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ name, ok, actual, expected });
  ok ? pass++ : fail++;
}
function stateOf(summary) { return scoreReadiness(summary).state; }

// ── Core states ──────────────────────────────────────────────────────────────
check("full ready → ready", stateOf(ladder({ Pain: L, Doubt: L, Cost: L, Desire: L, Money: L, Support: L, Trust: L })), "ready");
check("ready gap is empty", scoreReadiness(ladder({ Pain: L, Doubt: L, Cost: L, Desire: L, Money: L, Support: L, Trust: L })).gap, []);
check("ready allows Trust partial", stateOf(ladder({ Pain: L, Doubt: L, Cost: L, Desire: L, Money: L, Support: L, Trust: P })), "ready");

check("GAT locked, qualification open → almost", stateOf(ladder({ Pain: L, Doubt: L, Cost: L, Desire: L, Money: O, Support: O, Trust: L })), "almost");
check("almost gap = Investment, Who's Deciding", scoreReadiness(ladder({ Pain: L, Doubt: L, Cost: L, Desire: L, Money: O, Support: O, Trust: L })).gap, ["Investment", "Who's Deciding"]);

check("mid discovery (1 GAT locked) → continue", stateOf(ladder({ Pain: L, Doubt: P, Cost: O, Desire: O })), "continue");
check("2 GAT locked → continue", stateOf(ladder({ Pain: L, Doubt: L, Cost: O, Desire: O })), "continue");

check("undefined summary → not-ready", stateOf(undefined), "not-ready");
check("empty summary → not-ready", stateOf(""), "not-ready");
check("all open (early) → not-ready", stateOf(ladder({})), "not-ready");

// Cold start (nothing touched) → honest note, NO fake 2-item gap (Sebastian live-test 2026-07-15).
check("cold start (all open) → empty gap", scoreReadiness(ladder({})).gap, []);
check("cold start (all open) → discovery note", scoreReadiness(ladder({})).note, "Discovery hasn't started yet");
check("cold start via empty summary → discovery note", scoreReadiness(undefined).note, "Discovery hasn't started yet");
// But once ANY belief is touched, it's not cold → the top-2 gap returns, no note.
check("Pain partial (not cold) → 2-item gap", scoreReadiness(ladder({ Pain: P })).gap, ["Can't DIY", "Cost of Waiting"]);
check("Pain partial (not cold) → no note", scoreReadiness(ladder({ Pain: P })).note, undefined);

// ── W1: any live objection blocks green ───────────────────────────────────────
check("Trust ⚠️ (all else locked) → continue, NOT ready", stateOf(ladder({ Pain: L, Doubt: L, Cost: L, Desire: L, Money: L, Support: L, Trust: A })), "continue");
check("Trust ⚠️ gap = Why You", scoreReadiness(ladder({ Pain: L, Doubt: L, Cost: L, Desire: L, Money: L, Support: L, Trust: A })).gap, ["Why You"]);
check("Money ⚠️ (GAT locked) → continue, NOT almost", stateOf(ladder({ Pain: L, Doubt: L, Cost: L, Desire: L, Money: A, Support: L, Trust: L })), "continue");
check("Support ⚠️ (GAT locked) → continue, NOT almost", stateOf(ladder({ Pain: L, Doubt: L, Cost: L, Desire: L, Money: L, Support: A, Trust: L })), "continue");
check("core Cost ⚠️ → continue (both rules agree)", stateOf(ladder({ Pain: L, Doubt: L, Cost: A, Desire: L, Money: L, Support: L, Trust: L })), "continue");

// ── W2: a status glyph in the EVIDENCE text must not false-lock the belief ────
check("evidence ✅ does not lock Desire (stays partial → continue)",
  stateOf(ladder({ Pain: L, Doubt: L, Cost: L, Desire: P, Money: L, Support: L, Trust: L, ev: { Desire: "rep confirmed ✅ they want to 3x revenue" } })),
  "continue");

// ── W3: legend line + bulleted quotes are never parsed as beliefs ─────────────
const legendOnly = `▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ at-risk/objection)
▸ WEAKEST LINK → all beliefs open`;
check("legend line not parsed as a belief → not-ready", stateOf(legendOnly), "not-ready");

const quoteInjection = ladder({}) + `\n  • "1 Pain is killing me, we locked that ✅"`;
check("bulleted quote '1 Pain ✅' not parsed → still not-ready", stateOf(quoteInjection), "not-ready");

// ── VS16 variation-selector on ⚠️ is detected ─────────────────────────────────
check("⚠️ with U+FE0F detected as at-risk", stateOf(ladder({ Pain: A, Doubt: L, Cost: L, Desire: L })), "continue");

// ── Missing glyph → open (never inferred locked) ──────────────────────────────
const missingGlyph = ladder({ Pain: L, Doubt: L, Cost: L, Desire: L, Money: L, Support: L, Trust: L })
  .replace(/  1 Pain\s+✅/, "  1 Pain                 "); // Pain line loses its glyph
check("belief line with no glyph → open (blocks ready)", stateOf(missingGlyph), "continue");

// ── W10: duplicate belief line keeps the MOST CONSERVATIVE status ─────────────
const dupPain = ladder({ Pain: L, Doubt: L, Cost: L, Desire: L, Money: L, Support: L, Trust: L })
  + `\n  1 Pain                 ⬜ — actually they walked it back`;
check("duplicate '1 Pain' (✅ then ⬜) → min = open → not ready", stateOf(dupPain), "continue");

// ── No ladder block at all → not-ready ────────────────────────────────────────
check("random text with no ladder → not-ready", stateOf("hey this is just some transcript with no scorecard"), "not-ready");

// ── Gap priority: at-risk ranks before open ───────────────────────────────────
check("gap priority ⚠️ before ⬜ (Core Problem first)",
  scoreReadiness(ladder({ Pain: A, Doubt: O, Cost: O, Desire: O })).gap,
  ["Core Problem", "Can't DIY"]);

// ── Report ────────────────────────────────────────────────────────────────────
console.log("\n  close-readiness scoring gate\n  " + "─".repeat(48));
for (const r of results) {
  if (r.ok) {
    console.log(`  ✓ ${r.name}`);
  } else {
    console.log(`  ✗ ${r.name}`);
    console.log(`      expected: ${JSON.stringify(r.expected)}`);
    console.log(`      actual:   ${JSON.stringify(r.actual)}`);
  }
}
console.log("  " + "─".repeat(48));
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
