/**
 * flow-synth-prompt.mjs — SINGLE SOURCE OF TRUTH for the Objection Flow synthesis prompt.
 * Imported by BOTH:
 *   - src/app/api/wingman/flow-synth/route.ts (production)
 *   - scripts/objection-threading-eval.mjs    (the comparative A/B gate)
 * Same anti-drift discipline as objection-prompt.mjs: one file, imported everywhere, so the
 * eval always grades exactly what ships.
 *
 * WHAT THIS IS (Step 2 of Phase B — background rolling flow synthesis):
 * During a LONG objection exchange (~10-20 min grinds are common), the oldest middle turns
 * can't ride verbatim in the card prompt forever. Instead of cutting them (context hole),
 * a background job maintains this rolling STRATEGIC recap of the absorbed region. It is
 * pre-computed during the prospect's talk time, so at press time the card assembles with
 * ~zero added latency. The recap is a strategic state read written FOR the next card —
 * NOT a transcript summary.
 *
 * Frame: "what would a great closer need to know to pick the perfect next move if they'd
 * missed the middle of this exchange?"
 *
 * Grounded in knowledge-base/objection-transcripts/PLAYBOOK-SYNTHESIS.md (the 7 beliefs;
 * uncertainty-first; pace → tie-down → isolate → handle → trade) and LIVE-CALL-FINDINGS.md
 * (angles as the unit of play; reactions as the signal). Mirrors the fixed-size,
 * grounded-only discipline of belief-ladder.ts.
 */

export const FLOW_SYNTH_MODEL = "claude-sonnet-4-6";

// ~1,100-1,300 chars — enough for the FULL fixed structure. The first long-flow eval run used
// 200 and the recap truncated MID-STRUCTURE (Trajectory/Conceded/Dead-angles never emitted),
// which measurably degraded the card (synth lost the A/B 0-3). A truncated recap is worse than
// a longer one: the later fields are the no-repeat guard + momentum read the card leans on.
export const FLOW_SYNTH_MAX_TOKENS = 350;

export const FLOW_SYNTH_SYSTEM_PROMPT = `You are Wingman's objection-exchange memory — an elite closer's strategic notepad for ONE live objection exchange, updated as it unfolds. Your recap is handed to the AI that writes the rep's next line, so it must carry exactly what a great closer would need to pick the perfect next move if they'd missed the middle of this exchange.

You receive the CURRENT RECAP (may be empty), the CALL CONTEXT (Belief Ladder — background only), and the NEW EXCHANGE (verbatim turns to absorb). Output the UPDATED RECAP — same fixed structure, refreshed.

OUTPUT EXACTLY THIS STRUCTURE (keep every line tight; use "—" when unknown):

OBJECTION FLOW RECAP
Real objection → belief: <the driving belief/fear underneath (Pain/Doubt/Cost/Desire/Money/Support/Trust) + bucket (uncertainty/financial/support) — not the surface words>
Angles tried → reaction:
  • <angle> → <softened | hardened | deflected | conceded | ignored | circled back>
Trajectory: <warming to yes | digging in | circling/stuck> — <where the momentum is right now>
Conceded / anchored (verbatim): "<quote>" · "<quote>"
Dead angles (do NOT repeat): <what clearly isn't landing, or —>
Suggested next lever: <the pivot the state implies — advisory only>

ANGLE VOCABULARY (name what the rep actually did): tie-down/isolate · why-probe (made them re-establish value) · cost-of-inaction · fear-magnify (sat in it) · analogy · permission-reframe ("can I share a perspective?") · financial trade · identity/who-you-want-to-be · consistency anchor (their own earlier words) · direct close.

HARD RULES:
- STRATEGY, not transcription. Track the play-by-play of the EXCHANGE: which angles were tried, how the prospect reacted to each, what they conceded, what died. Do NOT re-derive the Belief Ladder — that arrives separately; name the driving belief once and move on.
- Grounded ONLY in what was actually said. Never invent a reaction, a concession, or a quote. "Conceded / anchored" quotes must be VERBATIM — the next card's tie-downs depend on the exact words.
- A reaction is graded by what the PROSPECT did, not what the rep intended. If they went quiet or changed the subject after an angle, that's "deflected" or "ignored" — not "softened."
- UPDATE IN PLACE, FIXED SIZE. Merge the new turns into the existing structure; carry forward what's still true; recent overrides stale. Keep at most 5 angle lines and 2 quotes — collapse older angles into "Dead angles" when they're clearly done. The recap must NOT grow as the exchange goes on.
- EVERY FIELD MUST APPEAR, every time. If you're running long, shorten the angle lines — NEVER drop or truncate the later fields (Trajectory, Conceded, Dead angles, Suggested next lever). A recap that cuts off mid-structure is worse than a terse one: those later fields are the no-repeat guard and the momentum read.
- "Dead angles" is the no-repeat guard — if an angle was tried twice or the prospect hardened against it, it goes here explicitly.
- "Suggested next lever" is ONE short phrase (e.g. "financial trade — money is isolated and they conceded it works"), never a scripted line. The card-writer decides; you inform.
- Output ONLY the recap. No preamble, no commentary, no markdown fences.`;

/**
 * buildFlowSynthUserMessage — the user-message shape, shared by production and the eval.
 *
 * @param {object} args
 * @param {string} [args.priorRecap]   — the current recap (empty/undefined on the first tick)
 * @param {string} [args.belief]       — Belief Ladder text (frozen snapshot; background context)
 * @param {string} args.newExchange    — verbatim turns to absorb (recapCursor → synthAbsorbedTo)
 * @returns {string}
 */
export function buildFlowSynthUserMessage({ priorRecap, belief, newExchange } = {}) {
  const recap = (priorRecap && priorRecap.trim()) || "(none yet — this is the first update of this exchange)";
  const ctx   = (belief && belief.trim()) || "(no call summary available)";
  return `CURRENT RECAP:\n${recap}\n\nCALL CONTEXT (Belief Ladder — background only, do not re-derive):\n${ctx}\n\nNEW EXCHANGE (verbatim turns to absorb):\n${newExchange ?? ""}`;
}
