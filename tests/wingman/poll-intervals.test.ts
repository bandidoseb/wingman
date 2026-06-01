import { describe, it, expect } from "vitest";
import {
  POLL_INTERVALS,
  CLOSER_STAGES,
  getStagesForRole,
  getDefaultStage,
} from "../../src/lib/wingman/poll-intervals";

describe("poll intervals", () => {
  it("has an interval for every closer stage", () => {
    for (const stage of CLOSER_STAGES) {
      expect(POLL_INTERVALS[stage]).toBeGreaterThan(0);
    }
  });

  it("fires fastest at Close and slowest at Rapport (core product rule: quiet early, alert at close)", () => {
    expect(POLL_INTERVALS.Close).toBeLessThan(POLL_INTERVALS.Discovery);
    expect(POLL_INTERVALS.Rapport).toBe(Math.max(...Object.values(POLL_INTERVALS)));
    expect(POLL_INTERVALS.Close).toBe(Math.min(...Object.values(POLL_INTERVALS)));
  });

  it("default stage is Rapport", () => {
    expect(getDefaultStage()).toBe("Rapport");
  });

  it("returns the six closer stages in order", () => {
    expect(getStagesForRole()).toEqual([
      "Rapport", "Discovery", "Press", "Confirm", "Pitch", "Close",
    ]);
  });
});
