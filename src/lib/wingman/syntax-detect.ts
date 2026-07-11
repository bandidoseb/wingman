/**
 * syntax-detect.ts — infer a rep's "problems-first vs goals-first" opening tendency
 * from their recent calls, so the Sales DNA "I'm not sure" answer is never a dead end.
 *
 * WHY THIS SHAPE: the opening syntax the rep actually used on a call is tagged by the
 * Belief-Ladder summarizer on the `Syntax:` line of the scorecard — but that scorecard
 * is stored as a TEXT BLOB in `calls.live_summary`, not a column. So detection = regex
 * the `Syntax:` value out of each recent summary and aggregate. The parse is the brittle
 * part (template drift would break it), so it's isolated here as a pure, unit-tested
 * function with defensive matching, separate from any I/O.
 *
 * It SUGGESTS, it never overwrites — an explicit "I'm not sure" is the rep's choice; we
 * surface a gentle "want to set this?" only once there's a clear, well-sampled tendency.
 */

export type DetectedSyntax = "problems" | "goals";

export interface SyntaxDetection {
  /** The suggested default, or null when there isn't enough clear signal yet. */
  detected: DetectedSyntax | null;
  /** Calls that opened problems-first / goals-first (readable signals only). */
  problems: number;
  goals: number;
  /** Usable signals found (problems + goals). Calls with no readable Syntax line don't count. */
  sample: number;
}

// Need at least this many calls with a *readable* Syntax signal before suggesting anything —
// one or two calls is noise. (~5 calls in the design; 3 readable is the real floor since some
// calls won't have a clear opening syntax.)
export const SYNTAX_MIN_SAMPLE = 3;
// And this share must agree, or it's genuinely mixed and we stay quiet (no false default).
export const SYNTAX_MAJORITY = 0.6;

// The summarizer prints exactly one of these on the `Syntax:` line (belief-ladder.ts):
//   "Stage: … · Elapsed: … · Syntax: <problems-first|goals-first|—>"
// Match the first occurrence per summary; tolerate spacing/case drift; ignore "—"/unknown.
const SYNTAX_LINE = /Syntax:\s*(problems-first|goals-first)/i;

/**
 * Aggregate the opening-syntax signal across a rep's recent call summaries.
 * Pure + total: any array (with nulls/garbage) yields a valid detection — never throws.
 *
 * @param summaries recent `calls.live_summary` blobs (newest-first or any order — order
 *                  doesn't matter to the tally)
 */
export function detectSyntax(summaries: Array<string | null | undefined>): SyntaxDetection {
  let problems = 0;
  let goals = 0;

  for (const summary of summaries) {
    if (typeof summary !== "string") continue;
    const m = summary.match(SYNTAX_LINE);
    if (!m) continue;
    if (/problems/i.test(m[1])) problems++;
    else goals++;
  }

  const sample = problems + goals;
  let detected: DetectedSyntax | null = null;
  if (sample >= SYNTAX_MIN_SAMPLE) {
    if (problems / sample >= SYNTAX_MAJORITY) detected = "problems";
    else if (goals / sample >= SYNTAX_MAJORITY) detected = "goals";
    // else: genuinely mixed → stay null (don't guess a default that isn't there)
  }

  return { detected, problems, goals, sample };
}
