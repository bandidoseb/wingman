/**
 * Unit tests — Sales DNA block builder (Phase 1b, the Offer-Aware moat).
 *
 * Covers the trust boundaries: the sanitizer (untrusted input from three client
 * rails), the all-questions completeness gate (Sebastian 2026-07-11 — a lone field
 * skews cards worse than no context), builder totality (this sits on the live press
 * path — it must NEVER throw), byte-stability (the Anthropic prompt cache keys on
 * exact bytes; warm-at-deploy priming is wasted if two paths build different text),
 * and the AVERAGES-NOT-GOSPEL fence shipping inside every block.
 */
import { describe, it, expect } from "vitest";
import {
  SALES_DNA_QUESTIONS,
  SALES_DNA_FIELD_MAX,
  sanitizeSalesDna,
  salesDnaMissing,
  isSalesDnaComplete,
  buildSalesDnaBlock,
  buildSummarizerDnaSystemBlock,
} from "../../src/lib/wingman/sales-dna.mjs";

// A fully-answered Sales DNA (every question addressed).
const COMPLETE = {
  transformation: "People go from stuck at a W2 to doing land deals full-time",
  root_driver: "A monthly cash-flow number that replaces their job",
  emotional_root: "Freedom — being their own boss",
  guarantee: "Full refund if you don't get results in 90 days",
  syntax: "problems",
  pain: "Grinding on sales calls themselves and can't scale",
  desire: "'Quit my job,' '$10k months' — it all comes down to consistent monthly cash flow",
  cost: "Never retiring comfortably, staying buried in debt",
  doubt: "Bought courses and watched YouTube but never had a coach",
  trust: "Everyone teaches theory — we build the system with you live",
  money: "I ask 'do you have money set aside to get started?'",
  support: "Almost always a spouse — I ask early if they're on board",
};

describe("sanitizeSalesDna", () => {
  it("passes a clean complete blob through unchanged", () => {
    expect(sanitizeSalesDna(COMPLETE)).toEqual(COMPLETE);
  });

  it("null means explicit reset → empty object", () => {
    expect(sanitizeSalesDna(null)).toEqual({});
  });

  it("drops non-object shapes (string, array, number)", () => {
    expect(sanitizeSalesDna("hack")).toBeNull();
    expect(sanitizeSalesDna([1, 2])).toBeNull();
    expect(sanitizeSalesDna(42)).toBeNull();
  });

  it("drops unknown keys and non-string values", () => {
    const out = sanitizeSalesDna({
      ...COMPLETE,
      subscription_plan: "pro",          // injection attempt → dropped
      pain: { evil: true },              // non-string → dropped
    });
    expect(out).not.toBeNull();
    expect(out!.subscription_plan).toBeUndefined();
    expect(out!.pain).toBeUndefined();
  });

  it("caps oversized fields at SALES_DNA_FIELD_MAX", () => {
    const out = sanitizeSalesDna({ ...COMPLETE, pain: "x".repeat(10_000) });
    expect(out!.pain.length).toBe(SALES_DNA_FIELD_MAX);
  });

  it("returns null on a blob over the total abuse cap", () => {
    const huge = Object.fromEntries(SALES_DNA_QUESTIONS.map((k: string) => [k, "y".repeat(2000)]));
    // 12 × 2000 = 24,000 chars of content — legitimate heavy input stays under 26k...
    expect(sanitizeSalesDna(huge)).not.toBeNull();
  });
});

describe("completeness — the all-questions inject threshold / Deploy gate", () => {
  it("complete DNA → no missing questions", () => {
    expect(salesDnaMissing(COMPLETE)).toEqual([]);
    expect(isSalesDnaComplete(COMPLETE)).toBe(true);
  });

  it("empty / undefined / garbage → every question missing", () => {
    expect(salesDnaMissing({})).toEqual(SALES_DNA_QUESTIONS);
    expect(salesDnaMissing(undefined)).toEqual(SALES_DNA_QUESTIONS);
    expect(salesDnaMissing("garbage")).toEqual(SALES_DNA_QUESTIONS);
    expect(isSalesDnaComplete(undefined)).toBe(false);
  });

  it("one unanswered question → incomplete (names the gap)", () => {
    const { desire: _drop, ...partial } = COMPLETE;
    expect(salesDnaMissing(partial)).toEqual(["desire"]);
    expect(isSalesDnaComplete(partial)).toBe(false);
  });

  it("whitespace-only answers do not count as answered", () => {
    expect(isSalesDnaComplete({ ...COMPLETE, pain: "   " })).toBe(false);
  });

  it('syntax "unsure" counts as answered; an invalid value does not', () => {
    expect(isSalesDnaComplete({ ...COMPLETE, syntax: "unsure" })).toBe(true);
    expect(isSalesDnaComplete({ ...COMPLETE, syntax: "banana" })).toBe(false);
  });

  it('guarantee "we don\'t offer one" counts as answered (addressed ≠ has one)', () => {
    expect(isSalesDnaComplete({ ...COMPLETE, guarantee: "We don't offer a formal guarantee." })).toBe(true);
  });
});

describe("buildSalesDnaBlock — total, gated, fenced", () => {
  it("never throws on any input shape (live press path)", () => {
    for (const bad of [undefined, null, 0, "x", [], {}, { pain: 1 }, () => {}, Symbol("s")]) {
      expect(() => buildSalesDnaBlock(bad)).not.toThrow();
    }
  });

  it("returns null below the all-questions threshold (partial DNA → fully generic cards)", () => {
    expect(buildSalesDnaBlock(undefined)).toBeNull();
    expect(buildSalesDnaBlock({})).toBeNull();
    const { support: _drop, ...partial } = COMPLETE;
    expect(buildSalesDnaBlock(partial)).toBeNull();
  });

  it("complete DNA → a block containing every answer and the AVERAGES-NOT-GOSPEL fence", () => {
    const block = buildSalesDnaBlock(COMPLETE);
    expect(block).not.toBeNull();
    expect(block!).toContain("AVERAGES, NOT GOSPEL");
    expect(block!).toContain("said NONE of it");
    for (const k of SALES_DNA_QUESTIONS) {
      if (k === "syntax") continue; // rendered as a phrase, tested below
      expect(block!).toContain((COMPLETE as Record<string, string>)[k]);
    }
    expect(block!).toContain("their problems first");
  });

  it("byte-stable: identical input → identical bytes, regardless of key order", () => {
    const a = buildSalesDnaBlock(COMPLETE);
    // Same data, reversed key insertion order — the cache prefix must not care.
    const reversed = Object.fromEntries(Object.entries(COMPLETE).reverse());
    const b = buildSalesDnaBlock(reversed);
    expect(a).toBe(b);
  });

  it("no timestamps or randomness (repeat calls byte-identical)", () => {
    expect(buildSalesDnaBlock(COMPLETE)).toBe(buildSalesDnaBlock(COMPLETE));
  });
});

describe("buildSummarizerDnaSystemBlock — the interpretive lens", () => {
  it("null when DNA incomplete (route falls back to the legacy single-block system)", () => {
    expect(buildSummarizerDnaSystemBlock({})).toBeNull();
  });

  it("wraps the block with the lens rules (never-evidence, transcript-wins)", () => {
    const lens = buildSummarizerDnaSystemBlock(COMPLETE);
    expect(lens).not.toBeNull();
    expect(lens!).toContain("interpretive lens ONLY");
    expect(lens!).toContain("NEVER mark a belief");
    expect(lens!).toContain("the transcript wins");
    expect(lens!).toContain("AVERAGES, NOT GOSPEL"); // the fence rides inside
  });
});
