/**
 * Tests for scripts/analyze-partials.mjs — the #41 measurement analyzer.
 *
 * The analyzer decides which reconciliation rule we build for the
 * stale-objection-tail bug, so its matching logic has to be right.
 * Fixtures are synthetic JSONL entries in the exact shape written by
 * electron/measurement-log.ts.
 */
import { describe, it, expect } from "vitest";
import {
  parseJsonl,
  normTokens,
  computeStats,
  dedupFinals,
  finalLeadTimes,
  arrivalLags,
  analyzePresses,
  buildReport,
} from "../../scripts/analyze-partials.mjs";

const partial = (ts: number, speaker: string, text: string, extra: Record<string, unknown> = {}) => ({
  ts, kind: "partial", speaker, text, ...extra,
});
const final = (ts: number, speaker: string, text: string, extra: Record<string, unknown> = {}) => ({
  ts, kind: "final", speaker, text, ...extra,
});
const press = (ts: number, path: string, slot: string | null = null) => ({
  ts, kind: "press", path, slot,
});

describe("parseJsonl", () => {
  it("parses lines and skips blank + torn lines", () => {
    const text = `{"ts":1,"kind":"final"}\n\n{"ts":2,"kind":"par`;
    const entries = parseJsonl(text);
    expect(entries).toEqual([{ ts: 1, kind: "final" }]);
  });
});

describe("normTokens", () => {
  it("lowercases and strips punctuation consistently on both streams", () => {
    // "don't" splits to ["don","t"] — consistent as long as BOTH sides are
    // normalized the same way, which is what matching relies on.
    expect(normTokens("I DON'T have the budget.")).toEqual([
      "i", "don", "t", "have", "the", "budget",
    ]);
    expect(normTokens("")).toEqual([]);
  });
});

describe("computeStats", () => {
  it("computes median/p90/max", () => {
    const s = computeStats([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
    expect(s.n).toBe(10);
    expect(s.median).toBe(600);
    expect(s.p90).toBe(1000);
    expect(s.max).toBe(1000);
  });
  it("handles empty input", () => {
    expect(computeStats([]).n).toBe(0);
    expect(computeStats([]).median).toBeNull();
  });
});

describe("dedupFinals", () => {
  it("mirrors the live pipeline: drops repeats until the speaker's text changes", () => {
    const entries = [
      final(1, "A", "yes"),
      final(2, "A", "yes"), // duplicate event — dropped
      final(3, "B", "yes"), // different speaker — kept
      final(4, "A", "ok"),  // text changed — kept
      final(5, "A", "yes"), // genuine repeat after other text — kept
    ];
    const { finals, duplicatesDropped } = dedupFinals(entries);
    expect(finals.map((f: { ts: number }) => f.ts)).toEqual([1, 3, 4, 5]);
    expect(duplicatesDropped).toBe(1);
  });
});

describe("finalLeadTimes", () => {
  it("measures how much earlier the partial stream had the final's tail", () => {
    const entries = [
      partial(1000, "P", "I don't"),
      partial(1600, "P", "I don't have the budget"),
      final(3200, "P", "I don't have the budget."),
    ];
    const { stats, matched, unmatched } = finalLeadTimes(entries);
    expect(matched).toBe(1);
    expect(unmatched).toBe(0);
    expect(stats.median).toBe(3200 - 1600);
  });

  it("counts finals with no matching partial as unmatched", () => {
    const entries = [
      partial(1000, "P", "something entirely different"),
      final(3000, "P", "I don't have the budget."),
    ];
    const { matched, unmatched } = finalLeadTimes(entries);
    expect(matched).toBe(0);
    expect(unmatched).toBe(1);
  });

  it("never matches a partial from another speaker", () => {
    const entries = [
      partial(1000, "Rep", "I don't have the budget"),
      final(2000, "Prospect", "I don't have the budget."),
    ];
    expect(finalLeadTimes(entries).matched).toBe(0);
  });
});

describe("arrivalLags", () => {
  it("computes arrival − spoken lag from absolute word timestamps", () => {
    const spokenAt = new Date(10_000).toISOString();
    const entries = [
      final(11_200, "P", "hello", { last_word_end_abs: spokenAt }),
      partial(10_300, "P", "hello", { last_word_end_abs: spokenAt }),
    ];
    const lags = arrivalLags(entries as never[]);
    expect(lags.hasAbsoluteTimestamps).toBe(true);
    expect(lags.final.median).toBe(1200);
    expect(lags.partial.median).toBe(300);
  });

  it("reports absence of absolute timestamps", () => {
    expect(arrivalLags([final(1, "P", "hi")]).hasAbsoluteTimestamps).toBe(false);
  });
});

describe("analyzePresses", () => {
  // The #41 scenario: rep presses the instant the objection ends; the
  // objection's final lands 2.2s AFTER the press, but a partial already
  // carried the full tail 200ms BEFORE the press.
  const scenario = [
    final(1000, "Prospect", "So yeah I hear you"),
    partial(2800, "Prospect", "but honestly I don't have the budget right now"),
    press(3000, "summon"),
    final(5200, "Prospect", "But honestly, I don't have the budget right now."),
  ];

  it("finds the missed tail and credits the partial stream with recovery", () => {
    const [report] = analyzePresses(scenario);
    expect(report.hadMissedTail).toBe(true);
    expect(report.msSinceLastFinal).toBe(2000);
    const s = report.speakers[0];
    expect(s.speaker).toBe("Prospect");
    expect(s.missedText).toBe("But honestly, I don't have the budget right now.");
    expect(s.freshPartialAgeMs).toBe(200);
    expect(s.recoveryRatio).toBe(1); // every missed word was already in the partial
    expect(s.bufferTailAtPress).toContain("So yeah I hear you");
  });

  it("ignores stale partials (older than the freshness window)", () => {
    const [report] = analyzePresses([
      partial(1000, "Prospect", "but honestly I don't have the budget right now"),
      press(15_000, "summon"),
      final(16_000, "Prospect", "But honestly, I don't have the budget right now."),
    ]);
    const s = report.speakers[0];
    expect(s.freshPartialText).toBeNull();
    expect(s.recoveredTokenCount).toBe(0);
  });

  it("reports a clean press when no finals land in the post-press window", () => {
    const [report] = analyzePresses([
      final(1000, "Prospect", "I don't have the budget."),
      press(1500, "double-tap", "objection"),
    ]);
    expect(report.hadMissedTail).toBe(false);
    expect(report.slot).toBe("objection");
  });

  it("excludes finals beyond the post-press window from the missed tail", () => {
    const [report] = analyzePresses([
      press(1000, "summon"),
      final(6000, "Prospect", "way later, unrelated"),
    ]);
    expect(report.hadMissedTail).toBe(false);
  });
});

describe("buildReport", () => {
  it("aggregates the recovery verdict across presses", () => {
    const report = buildReport([
      final(1000, "Prospect", "So yeah I hear you"),
      partial(2800, "Prospect", "but honestly I don't have the budget right now"),
      press(3000, "summon"),
      final(5200, "Prospect", "But honestly, I don't have the budget right now."),
    ]);
    expect(report.counts.presses).toBe(1);
    expect(report.verdict.totalMissedWords).toBeGreaterThan(0);
    expect(report.verdict.recoveryRate).toBe(1);
  });
});
