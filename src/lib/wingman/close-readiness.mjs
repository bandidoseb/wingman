/**
 * close-readiness.mjs — SINGLE SOURCE OF TRUTH for the → Close readiness chip's scoring.
 *
 * Imported by BOTH:
 *   - src/app/(dashboard)/dashboard/DashboardClient.tsx (production — client-side, on → press)
 *   - scripts/test-close-readiness.mjs                  (the offline gate)
 * Same anti-drift discipline as dig-prompt.mjs / objection-prompt.mjs: the gate is plain Node
 * (.mjs) and can't import a .ts, so the logic lives here and both sides import it — the test
 * always grades exactly what ships.
 *
 * WHAT THIS DOES: deterministically turns the Belief Ladder scorecard text (from the summarizer)
 * into one of 4 readiness states + the gap (weakest beliefs) to name. NO AI, NO I/O — pure.
 *
 * DESIGN (Sebastian-locked 2026-07-15, hardened by plan-review):
 *   - GAT (core) beliefs = Pain · Doubt(can't DIY) · Cost(of inaction) · Desire — must be LOCKED
 *     to earn the pitch. Money + Support(who decides) must be LOCKED for "Ready". Trust may stay
 *     soft (it's built during the pitch).
 *   - CONSERVATIVE BIAS: false "Ready" is the expensive mistake. Only an exact ✅ counts as locked;
 *     a missing/ambiguous status degrades to ⬜ open (never inferred locked); ANY ⚠️ at-risk (a live
 *     objection anywhere) blocks the green states.
 */

/** @typedef {"not-ready"|"continue"|"almost"|"ready"} ReadinessState */
/** @typedef {"locked"|"partial"|"open"|"atrisk"} BeliefStatus */
/** @typedef {{ state: ReadinessState, label: string, gap: string[], cold: boolean, note?: string }} Readiness */

// Cold-start line — shown instead of a gap list when NOTHING has been covered yet. Naming a top-2
// gap when the rep has touched nothing is misleading (it implies only those 2 matter). Mirrors the
// dig card's cold-start ("Start the conversation").
export const COLD_START_NOTE = "Discovery hasn't started yet";

// Rep-facing DISPLAY names — OUR pillar names (plain English, no methodology jargon). Keyed by the
// raw taxonomy id. Single source shared by the readiness gap AND the dig tag (DashboardClient
// imports this map so the two live-call surfaces can never drift). Also matches FlightLogTab.
/** @type {Record<string, string>} */
export const BELIEF_DISPLAY = {
  Pain: "Core Problem", Doubt: "Can't DIY", Cost: "Cost of Waiting", Desire: "Dream Outcome",
  Money: "Investment", Support: "Who's Deciding", Trust: "Why You",
};

/** @type {Record<ReadinessState, string>} — the two-word chip labels. */
export const READINESS_LABELS = {
  "not-ready": "Not Ready",
  "continue":  "Continue Discovery",
  "almost":    "Almost Ready",
  "ready":     "Ready to Pitch",
};

// The 7 beliefs in taxonomy order (GAT first, then qualification, then Trust). Each row is
// anchored by its NUMBER (1–7) in the ladder and validated by a tolerant NAME token so a
// coincidental "3 months left ⚠️" or a bulleted quote can't inject a status.
const BELIEFS = [
  { id: "Pain",    num: 1, re: /pain/i },
  { id: "Doubt",   num: 2, re: /doubt|diy/i },
  { id: "Cost",    num: 3, re: /cost/i },
  { id: "Desire",  num: 4, re: /desire/i },
  { id: "Money",   num: 5, re: /money/i },
  { id: "Support", num: 6, re: /support|decid/i },
  { id: "Trust",   num: 7, re: /trust/i },
];

const GAT_IDS = ["Pain", "Doubt", "Cost", "Desire"];

// Conservatism rank for the duplicate-line tiebreak (lower = worse = kept). at-risk is "worst"
// because it downgrades the whole chip (blocks green); then open, partial, locked.
const STATUS_RANK = { atrisk: 0, open: 1, partial: 2, locked: 3 };

/** Strip the U+FE0F variation selector so ⚠️ / ⬜️ match their base codepoints. */
function stripVS(s) {
  return s.replace(/️/g, "");
}

/**
 * Read the status glyph from the region between the belief name and the first em/en-dash (the
 * status↔evidence separator). The evidence text is OFF-LIMITS — it can contain "confirmed ✅ …",
 * which would false-lock the belief if we scanned the whole line.
 * @returns {BeliefStatus | null} null = no recognizable glyph (caller keeps the ⬜ open default)
 */
function parseStatus(rest) {
  // Cut at the first em-dash / en-dash; fall back to a spaced hyphen. The name region never
  // contains an em/en-dash, and "Doubt (can't DIY)" / "Support (who decides)" have no spaced hyphen.
  let idx = -1;
  for (let i = 0; i < rest.length; i++) {
    const c = rest[i];
    if (c === "—" || c === "–") { idx = i; break; }
  }
  if (idx === -1) {
    const h = rest.indexOf(" - ");
    if (h !== -1) idx = h;
  }
  const region = stripVS(idx === -1 ? rest : rest.slice(0, idx));

  // Only an exact ✅ (U+2705) counts as locked. Check at-risk before partial/open. A well-formed
  // region holds exactly one glyph, so precedence only matters for malformed input — and there we
  // prefer the more conservative reading.
  if (region.includes("✅")) return "locked";   // ✅
  if (region.includes("⚠")) return "atrisk";   // ⚠
  if (region.includes("🟡")) return "partial"; // 🟡
  if (region.includes("⬜") || region.includes("⬛")) return "open"; // ⬜ / ⬛
  return null;
}

/**
 * Parse the Belief Ladder scorecard text into a status per belief. Anything not affirmatively
 * parsed stays ⬜ open (conservative — never inferred locked). Duplicate belief numbers keep the
 * MOST CONSERVATIVE status.
 * @param {string} summary
 * @returns {Record<string, BeliefStatus>}
 */
function parseLadder(summary) {
  /** @type {Record<string, BeliefStatus>} */
  const statuses = {};
  for (const b of BELIEFS) statuses[b.id] = "open";
  if (!summary || typeof summary !== "string") return statuses;

  const seen = {};
  for (const raw of summary.split(/\r?\n/)) {
    const line = raw.trim();
    // Must start with a lone digit 1–7 then whitespace. This skips the "▸ BELIEF LADDER (✅…)"
    // legend, THE GAP, WEAKEST LINK, OPEN OBJECTIONS, and bulleted `• "…"` quotes by construction.
    const m = /^([1-7])\s+(.*)$/.exec(line);
    if (!m) continue;
    const belief = BELIEFS.find((b) => b.num === Number(m[1]));
    if (!belief) continue;
    const rest = m[2];
    // Validate the name matches the number — guards against a coincidental "3 months…" line.
    if (!belief.re.test(rest)) continue;
    const st = parseStatus(rest);
    if (st == null) continue; // no glyph → leave the conservative ⬜ open default

    if (seen[belief.id]) {
      // Duplicate line → keep whichever is more conservative (lower rank).
      if (STATUS_RANK[st] < STATUS_RANK[statuses[belief.id]]) statuses[belief.id] = st;
    } else {
      statuses[belief.id] = st;
      seen[belief.id] = true;
    }
  }
  return statuses;
}

/**
 * Build the gap list — the weakest not-locked beliefs to name, top 2. Priority ⚠️ → ⬜ → 🟡, and
 * within a priority GAT(1–4) → qualification(5–6) → Trust(7). Returns rep-facing display names.
 * @param {Record<string, BeliefStatus>} st
 * @returns {string[]}
 */
function buildGap(st) {
  return BELIEFS
    .filter((b) => st[b.id] !== "locked")
    .map((b, i) => ({ id: b.id, rank: STATUS_RANK[st[b.id]] ?? 1, seq: BELIEFS.findIndex((x) => x.id === b.id) }))
    .sort((a, b) => a.rank - b.rank || a.seq - b.seq)
    .slice(0, 2)
    .map((c) => BELIEF_DISPLAY[c.id] ?? c.id);
}

/**
 * Score the Belief Ladder into a readiness chip. Pure — safe to call on every → press.
 * @param {string} [summary] the live_summary text; undefined/empty (early call) → Not Ready.
 * @returns {Readiness}
 */
export function scoreReadiness(summary) {
  const st = parseLadder(summary ?? "");
  const isLocked = (id) => st[id] === "locked";

  const anyAtRisk = BELIEFS.some((b) => st[b.id] === "atrisk");
  const gatLocked = GAT_IDS.filter(isLocked).length;
  const gatSignal = GAT_IDS.filter((id) => st[id] === "locked" || st[id] === "partial").length;
  const moneyOk   = isLocked("Money");
  const supportOk = isLocked("Support");

  /** @type {ReadinessState} */
  let state;
  if (anyAtRisk)                                     state = "continue";  // any live objection blocks green
  else if (gatLocked === 4 && moneyOk && supportOk)  state = "ready";
  else if (gatLocked === 4)                          state = "almost";    // core built, qualification pending
  else if (gatLocked === 0 && gatSignal <= 1)        state = "not-ready"; // barely started
  else                                               state = "continue";

  // Cold start = every belief still open (nothing touched). Show an honest note, not a fake 2-gap.
  // `cold` is also exposed on the return (#52): the dig nudge gate in kb-signal uses it to block
  // the take-close line on a ladder with zero discovery — same engine, so the arrows agree.
  const cold = BELIEFS.every((b) => st[b.id] === "open");
  if (cold) return { state, label: READINESS_LABELS[state], gap: [], cold, note: COLD_START_NOTE };

  const gap = state === "ready" ? [] : buildGap(st);
  return { state, label: READINESS_LABELS[state], gap, cold };
}

/**
 * #52 dig nudge gate — is this ladder showing ZERO discovery? True when the summary is
 * missing/blank OR every belief parses as ⬜ open. Used by kb-signal's dig branch to block the
 * "take the close" nudge on a cold call (a take-close with nothing built is never real — it's the
 * model's escape hatch on a degenerate transcript). Deliberately NARROW: one touched belief (even
 * a single 🟡) returns false, preserving the verbal-readiness override ("how do we get started?"
 * early in a call → the doctrine says take the close, and this gate must never eat it).
 * @param {string} [summary] the live_summary text
 * @returns {boolean}
 */
export function isColdLadder(summary) {
  return !summary?.trim() || scoreReadiness(summary).cold;
}
