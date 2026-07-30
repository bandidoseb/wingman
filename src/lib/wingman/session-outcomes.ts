import type { Call } from "@/types";

/**
 * Overlay the outcomes a rep confirmed THIS SESSION onto the server rows.
 *
 * Extracted from the provider so the one behaviour that can silently change a
 * number on screen is unit-testable.
 *
 * ⚠️ `outcome_source: "manual"` is load-bearing, not decoration. `confirmedOutcome()`
 * EXCLUDES rows still marked `"auto"` from every statistic — Sebastian's standing
 * rule that a wrong auto-detection must never quietly poison the numbers. Overlay the
 * outcome without flipping the source and a call the rep just confirmed still doesn't
 * count: the Coach answers "what's my close rate" ignoring the ✓ from two seconds
 * ago, and Flight Log asks them to confirm a call they already confirmed.
 *
 * Home and Flight Log each used to keep their own copy of this map, in different
 * shapes — Home's flipped the source, Flight Log's was a bare string — so a
 * confirmation made in one was invisible to the other.
 */
export function applySessionOutcomes(
  calls: Call[],
  sessionOutcomes: Record<string, string>
): Call[] {
  // Cheap identity fast-path: nothing confirmed yet is the common case, and
  // returning the SAME array lets memoised consumers skip their work entirely.
  if (Object.keys(sessionOutcomes).length === 0) return calls;

  return calls.map((c) =>
    sessionOutcomes[c.id]
      ? {
          ...c,
          outcome: sessionOutcomes[c.id] as Call["outcome"],
          outcome_source: "manual" as const,
        }
      : c
  );
}
