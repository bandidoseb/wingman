/**
 * tic-gate.mjs — deterministic AI-tic detector for Wingman signal cards.
 *
 * Pure, no deps, unit-testable. This is the TRUSTWORTHY scorer for the MECHANICAL tics
 * that the LLM tonality judge cannot feel — it scored tic-ridden cards 4.8/5. Sebastian
 * is the judge of everything SUBTLE; this gate only catches his EXACT flagged phrasings.
 *
 *   scanTics(line, family) → { hard: string[], soft: string[] }
 *     family : "objection" | "dig"
 *     hard   = ship-blocking tics (the shipped `direct` voice must have ZERO)
 *     soft   = advisory only (flag in the batch, do NOT fail)
 *
 * PRECISION OVER RECALL, by design. Only exact, Sebastian-flagged phrasings are banned.
 * Paraphrases ("that feeling makes complete sense") slip through ON PURPOSE — the gate is
 * the mechanical floor, not a comprehensive humanness judge. Do not broaden it into fuzzy
 * matching; over-banning kills good lines (Sebastian: "don't cut good things").
 *
 * Ban-list source of truth: tasks/card-voice-spec.md.
 */

const FAMILIES = ["objection", "dig"];

// "come on" / "c'mon" ONLY as a lead-in — line start, or right after sentence punctuation /
// a comma / a dash. This avoids false positives on legitimate mid-sentence use like
// "what would have to come on the table for this to be a yes?".
const COME_ON_LEADIN = /(^|[.!?,;:—–-]\s*)(come on|c['’]?mon)\b/i;

// The permission-ask-before-a-reframe tic. "can I ask" / "can I ask you something (honestly)".
const CAN_I_ASK = /\bcan i ask\b/i;

// A specific canned permission phrase Sebastian flagged as an over-use / industry-tic risk.
const SHARE_A_PERSPECTIVE = /\bcan i share a perspective\b/i;

// Forced-empathy clichés — canned attempts to name/narrate a human emotion. EXACT near-forms
// only (naming the emotion is the tell; generic warmth is fine and must pass).
const EMPATHY_CLICHES = [
  /\bgetting burned is real\b/i,
  /\bthat feeling makes (total|complete) sense\b/i,
  /\bthat nervousness is( actually)? a good sign\b/i,
];

/**
 * @param {string} line   — the card line to scan
 * @param {"objection"|"dig"} family
 * @returns {{ hard: string[], soft: string[] }}
 */
export function scanTics(line, family) {
  const s = String(line ?? "");
  const fam = FAMILIES.includes(family) ? family : "objection";
  const hard = [];
  const soft = [];
  const add = (arr, id) => { if (!arr.includes(id)) arr.push(id); };

  // "come on" lead-in — both families, hard.
  if (COME_ON_LEADIN.test(s)) add(hard, "come-on-leadin");

  // "can I ask …" — objection: hard (always a tic there). dig: soft only, because the
  // pre-frame "can I ask you something personal?" is a legit NEPQ move Sebastian hasn't
  // ruled out yet. The whole dig doctrine is deferred, so nothing on dig hard-fails here.
  if (CAN_I_ASK.test(s)) add(fam === "objection" ? hard : soft, "can-i-ask");

  // Baked canned permission phrase — hard, both families.
  if (SHARE_A_PERSPECTIVE.test(s)) add(hard, "share-a-perspective");

  // Forced-empathy clichés — hard, both families.
  for (const re of EMPATHY_CLICHES) {
    if (re.test(s)) { add(hard, "empathy-cliche"); break; }
  }

  return { hard, soft };
}
