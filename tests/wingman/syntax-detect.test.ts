/**
 * Unit tests — syntax auto-detect (the "I'm not sure" fast-follow).
 * The regex-parse of the `Syntax:` line out of the live_summary blob is the brittle part,
 * so it gets the teeth: real scorecard shapes, thresholds, mixed signal, and garbage input.
 */
import { describe, it, expect } from "vitest";
import { detectSyntax, SYNTAX_MIN_SAMPLE } from "../../src/lib/wingman/syntax-detect";

// A realistic summarizer scorecard header (matches belief-ladder.ts output).
const card = (syntax: string) =>
  `LIVE CALL MEMORY\nStage: Discovery · Elapsed: 14m · Syntax: ${syntax}\n▸ THE GAP\n  Current "hell": …`;

describe("detectSyntax", () => {
  it("returns null below the minimum sample (one or two calls is noise)", () => {
    const d = detectSyntax([card("problems-first"), card("problems-first")]);
    expect(d.sample).toBe(2);
    expect(d.detected).toBeNull();
  });

  it("detects problems-first on a clear, well-sampled majority", () => {
    const d = detectSyntax([card("problems-first"), card("problems-first"), card("problems-first")]);
    expect(d.detected).toBe("problems");
    expect(d.problems).toBe(3);
    expect(d.sample).toBe(SYNTAX_MIN_SAMPLE);
  });

  it("detects goals-first likewise", () => {
    const d = detectSyntax([card("goals-first"), card("goals-first"), card("goals-first"), card("goals-first")]);
    expect(d.detected).toBe("goals");
    expect(d.goals).toBe(4);
  });

  it("stays null on a genuinely mixed signal (no false default)", () => {
    // 3 vs 3 = 50%, below the 60% majority.
    const d = detectSyntax([
      card("problems-first"), card("problems-first"), card("problems-first"),
      card("goals-first"), card("goals-first"), card("goals-first"),
    ]);
    expect(d.detected).toBeNull();
    expect(d.sample).toBe(6);
  });

  it("declares on a 60%+ lean (4 of 6 problems)", () => {
    const d = detectSyntax([
      card("problems-first"), card("problems-first"), card("problems-first"), card("problems-first"),
      card("goals-first"), card("goals-first"),
    ]);
    expect(d.detected).toBe("problems");
  });

  it("ignores calls with no readable Syntax line (the '—' / early-drop case)", () => {
    const d = detectSyntax([
      card("problems-first"), card("problems-first"), card("problems-first"),
      card("—"), "some blob with no syntax line at all", "",
    ]);
    expect(d.sample).toBe(3);          // only the 3 readable ones count
    expect(d.detected).toBe("problems");
  });

  it("is total: null/undefined/garbage never throw", () => {
    expect(() => detectSyntax([null, undefined, 42 as unknown as string, {} as unknown as string])).not.toThrow();
    const d = detectSyntax([null, undefined]);
    expect(d).toEqual({ detected: null, problems: 0, goals: 0, sample: 0 });
  });

  it("empty input → clean empty detection", () => {
    expect(detectSyntax([])).toEqual({ detected: null, problems: 0, goals: 0, sample: 0 });
  });

  it("tolerates spacing/case drift on the Syntax line", () => {
    const d = detectSyntax([
      "syntax:problems-first",
      "Syntax:   Problems-First",
      "… · Syntax: problems-first · …",
    ]);
    expect(d.detected).toBe("problems");
    expect(d.sample).toBe(3);
  });
});
