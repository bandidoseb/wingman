/**
 * Unit tests — #52 dig nudge gate (isColdLadder) + the `cold` field on scoreReadiness.
 *
 * The bug (Known Issue #52, Flight Recorder call 928e4249): on a call with ZERO discovery
 * (empty summary / every belief ⬜ open), the dig model's only escape hatch is {null,null},
 * which the kb-signal route rendered as "They're ready — go for the close." The gate blocks
 * that — and ONLY that. The critical fence (plan-review W5): the gate must be strictly
 * narrower than the "not-ready" readiness state, or it clobbers the verbal-readiness
 * doctrine (prospect says "how do we get started?" with only Pain touched → take the close).
 */
import { describe, it, expect } from "vitest";
import { isColdLadder, scoreReadiness } from "../../src/lib/wingman/close-readiness.mjs";

// The REAL ladder text from the bug call (dev-logs/call-928e4249…), verbatim shape.
const ALL_OPEN_LADDER = `LIVE CALL MEMORY
Stage: — · Elapsed: 1m · Syntax: —
▸ THE GAP
  Current "hell":   —
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)
  1 Pain                  ⬜ open — no prospect on call yet / no sales conversation detected
  2 Doubt (can't DIY)     ⬜ open — —
  3 Cost (of inaction)    ⬜ open — —
  4 Desire                ⬜ open — —
  5 Money                 ⬜ open — —
  6 Support (who decides) ⬜ open — —
  7 Trust (why you)       ⬜ open — —
▸ WEAKEST LINK → all beliefs open — no prospect conversation has begun`;

// Same ladder with exactly ONE belief touched (Pain 🟡). This still scores "not-ready"
// (0 GAT locked, 1 touched) — which is exactly why the gate must NOT key on "not-ready".
const ONLY_PAIN_PARTIAL = ALL_OPEN_LADDER.replace(
  "1 Pain                  ⬜ open — no prospect on call yet / no sales conversation detected",
  "1 Pain                  🟡 partial — says he can't focus, hasn't owned the cost yet"
);

const ALL_LOCKED = ALL_OPEN_LADDER
  .replace(/⬜ open/g, "✅ locked")
  .replace("▸ WEAKEST LINK → all beliefs open — no prospect conversation has begun",
           "▸ WEAKEST LINK → all beliefs locked — ready to close");

describe("isColdLadder — the #52 dig take-close gate", () => {
  it("gates a missing summary (the first press of the bug call sent an empty string)", () => {
    expect(isColdLadder(undefined)).toBe(true);
    expect(isColdLadder("")).toBe(true);
    expect(isColdLadder("   \n  ")).toBe(true);
  });

  it("gates the real all-open ladder from the bug call", () => {
    expect(isColdLadder(ALL_OPEN_LADDER)).toBe(true);
  });

  it("does NOT gate a ladder with a single touched belief — the verbal-readiness doctrine survives (W5)", () => {
    // The prospect can say "how do we get started?" with only Pain partial; the doctrine says
    // take the close. This state scores "not-ready" — proving the gate is narrower than that.
    expect(scoreReadiness(ONLY_PAIN_PARTIAL).state).toBe("not-ready");
    expect(isColdLadder(ONLY_PAIN_PARTIAL)).toBe(false);
  });

  it("does NOT gate a built ladder (the legitimate take-close)", () => {
    expect(isColdLadder(ALL_LOCKED)).toBe(false);
  });

  it("never throws on garbage input (sits on the live press path)", () => {
    expect(() => isColdLadder("random text with no ladder at all")).not.toThrow();
    // No parseable belief rows → every belief degrades to ⬜ open → cold. Conservative and correct:
    // an unreadable ladder is zero evidence of discovery, so the take-close claim stays blocked.
    expect(isColdLadder("random text with no ladder at all")).toBe(true);
  });
});

describe("scoreReadiness — additive `cold` field", () => {
  it("exposes cold=true on an all-open ladder, keeping the chip fields intact", () => {
    const r = scoreReadiness(ALL_OPEN_LADDER);
    expect(r.cold).toBe(true);
    expect(r.state).toBe("not-ready");
    expect(r.gap).toEqual([]);
    expect(r.note).toBeTruthy(); // the cold-start note the chip already showed — unchanged
  });

  it("exposes cold=false the moment any belief is touched", () => {
    const r = scoreReadiness(ONLY_PAIN_PARTIAL);
    expect(r.cold).toBe(false);
    expect(r.note).toBeUndefined(); // non-cold path never carried a note — unchanged
  });
});
