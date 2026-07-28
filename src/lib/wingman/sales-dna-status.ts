import type { SalesDna } from "@/types";

/**
 * Is the rep's Sales DNA filled in enough to stop nagging them about it?
 *
 * The Home banner pins itself to the top of the screen until this returns
 * "complete", so the bar has to be honest: high enough that a half-filled DNA
 * doesn't silently dismiss the prompt, low enough that we're not blocking on
 * the long tail of optional fields.
 *
 * ANCHORS are the three the live rails actually depend on:
 *   transformation — what you sell (before → after)
 *   root_driver    — ⭐ the one thing every client is chasing
 *   desire         — ⭐ manifestations, chunked down to the root
 *
 * The other nine sharpen cards but nothing breaks without them, so they count
 * toward progress and never toward "done".
 */
const ANCHORS = ["transformation", "root_driver", "desire"] as const;

const ALL_FIELDS = [
  "transformation", "root_driver", "emotional_root", "guarantee",
  "syntax", "pain", "desire", "cost", "doubt", "trust", "money", "support",
] as const;

const filled = (v: unknown): boolean =>
  typeof v === "string" ? v.trim().length > 0 : v != null;

export type SalesDnaStatus = {
  /** "empty" = nothing yet · "partial" = started, anchors missing · "complete" = anchors in */
  state: "empty" | "partial" | "complete";
  /** How many of the 12 fields have content — drives the "N of 12" progress copy. */
  filledCount: number;
  totalCount: number;
};

export function getSalesDnaStatus(dna: SalesDna | null | undefined): SalesDnaStatus {
  const d = dna ?? {};
  const filledCount = ALL_FIELDS.reduce(
    (n, k) => n + (filled((d as Record<string, unknown>)[k]) ? 1 : 0),
    0
  );

  const anchorsIn = ANCHORS.every((k) => filled((d as Record<string, unknown>)[k]));

  return {
    state: anchorsIn ? "complete" : filledCount === 0 ? "empty" : "partial",
    filledCount,
    totalCount: ALL_FIELDS.length,
  };
}
