/**
 * Unit tests — Sales DNA completeness (drives the Home banner).
 *
 * The banner pins itself to the top of Home until this says "complete", so the
 * bar has to be exactly right in both directions: a half-filled DNA must not
 * silently dismiss the prompt, and a rep who answered the three anchors must not
 * keep getting nagged. The anchors are the fields the live rails actually read.
 */
import { describe, it, expect } from "vitest";
import { getSalesDnaStatus } from "../../src/lib/wingman/sales-dna-status";

describe("getSalesDnaStatus", () => {
  it("treats null / undefined / {} as empty", () => {
    expect(getSalesDnaStatus(null).state).toBe("empty");
    expect(getSalesDnaStatus(undefined).state).toBe("empty");
    expect(getSalesDnaStatus({}).state).toBe("empty");
  });

  it("is complete only when all three anchors are filled", () => {
    expect(
      getSalesDnaStatus({ transformation: "x", root_driver: "y", desire: "z" }).state
    ).toBe("complete");
  });

  it("stays partial when an anchor is missing, however much else is filled", () => {
    const s = getSalesDnaStatus({
      transformation: "x",
      root_driver: "y", // desire missing
      pain: "a", cost: "b", doubt: "c", trust: "d", money: "e", support: "f",
      emotional_root: "g", guarantee: "h",
    });
    expect(s.state).toBe("partial");
    expect(s.filledCount).toBe(10);
  });

  it("does not count whitespace-only strings as filled", () => {
    const s = getSalesDnaStatus({ transformation: "   ", root_driver: "y", desire: "z" });
    expect(s.state).toBe("partial");
    expect(s.filledCount).toBe(2);
  });

  it("counts non-string fields (syntax) when present", () => {
    // `syntax` is an enum-ish value, not free text — it must still count.
    const s = getSalesDnaStatus({ syntax: "problem" as never });
    expect(s.filledCount).toBe(1);
    expect(s.state).toBe("partial");
  });

  it("reports a stable total so the 'N of 12' copy can't drift", () => {
    expect(getSalesDnaStatus({}).totalCount).toBe(12);
  });
});
