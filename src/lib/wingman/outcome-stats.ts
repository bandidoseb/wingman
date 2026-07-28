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

/**
 * How long after a call ends before "zero transcript rows" may be treated as final.
 *
 * post-call skips any call with no transcript and writes nothing, so `summary` stays
 * null forever and the HUD pill / Flight Log skeleton would spin to their 6-minute
 * dead-man timers. Zero rows is only conclusive once no save can still be landing:
 * transcript saves in flight at call end are bounded by flushBuffer's 10s abort (it
 * early-returns when the 25s auto-save is mid-request, so awaiting it proves nothing),
 * making this a 3× margin — and still 12× faster than the dead-man timers.
 *
 * Lives here (not in DashboardClient) because FlightLogTab needs it too and
 * DashboardClient imports FlightLogTab — importing back would be circular.
 */
export const NO_DEBRIEF_GRACE_MS = 30_000;
