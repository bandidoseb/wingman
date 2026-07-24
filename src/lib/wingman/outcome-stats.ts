import type { Call } from "@/types";

/**
 * The outcome to COUNT in close-rate / breakdown stats.
 *
 * AI-auto-detected outcomes (`outcome_source === 'auto'`) are EXCLUDED until the
 * rep confirms them — Sebastian's standing rule: a wrong auto-guess must never
 * silently poison the stats. Confirming = any manual pick, which flips the row's
 * `outcome_source` to 'manual' (see /api/wingman/outcome). Legacy rows written
 * before this column existed have `outcome_source == null` and count as before.
 *
 * Returns the confirmed outcome string, or null when the call is unmarked OR
 * only auto-marked (both treated identically for stats — as "no outcome yet").
 */
export function confirmedOutcome(
  call: Pick<Call, "outcome" | "outcome_source">
): string | null {
  if (call.outcome && call.outcome_source !== "auto") return call.outcome;
  return null;
}
