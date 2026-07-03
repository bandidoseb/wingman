/**
 * Tests for src/lib/wingman/live-tail.ts — the #41 press-time partial merge.
 *
 * The load-bearing behaviors (plan rev 2):
 *  - hotPartialAgeMs() === +Infinity when empty — this is what guarantees
 *    zero settle-wait and byte-identical requests on old packaged apps.
 *  - Dedup is STRICT substring: suppress only when the ENTIRE partial is
 *    already in the finals tail; partial overlap still emits.
 *  - Stale partials (>5s) never emit and get swept (bounded map).
 */
import { describe, it, expect } from "vitest";
import {
  createLiveTailState,
  updatePartial,
  clearSpeakerFromFinal,
  getLiveTail,
  hotPartialAgeMs,
  normalizeForMatch,
  LIVE_TAIL_MARKER,
  PARTIAL_FRESH_MS,
  LIVE_TAIL_MAX_CHARS,
} from "../../src/lib/wingman/live-tail";

describe("hotPartialAgeMs", () => {
  it("returns +Infinity when no partial exists (old apps / genuine pause)", () => {
    expect(hotPartialAgeMs(createLiveTailState(), 1000)).toBe(Number.POSITIVE_INFINITY);
  });

  it("returns the freshest partial's age", () => {
    const s = createLiveTailState();
    updatePartial(s, "Prospect: I don't know about", 1000);
    updatePartial(s, "Rep: well what if we", 2000);
    expect(hotPartialAgeMs(s, 2300)).toBe(300);
  });

  it("returns +Infinity when every partial is past freshness", () => {
    const s = createLiveTailState();
    updatePartial(s, "Prospect: something old", 1000);
    expect(hotPartialAgeMs(s, 1000 + PARTIAL_FRESH_MS + 1)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("updatePartial / clearSpeakerFromFinal", () => {
  it("keeps only the freshest partial per speaker", () => {
    const s = createLiveTailState();
    updatePartial(s, "Prospect: I don't", 1000);
    updatePartial(s, "Prospect: I don't have the budget", 1400);
    const tail = getLiveTail(s, "", 1500);
    expect(tail).toBe(`Prospect ${LIVE_TAIL_MARKER}: I don't have the budget`);
  });

  it("a speaker's final consumes ONLY that speaker's partial", () => {
    const s = createLiveTailState();
    updatePartial(s, "Prospect: I don't have the budget", 1000);
    updatePartial(s, "Rep: okay so walk me through", 1100);
    clearSpeakerFromFinal(s, "Prospect: I don't have the budget right now.");
    const tail = getLiveTail(s, "", 1200);
    expect(tail).toContain("Rep");
    expect(tail).not.toContain("Prospect");
  });

  it("ignores malformed lines (no colon, empty speaker or text)", () => {
    const s = createLiveTailState();
    updatePartial(s, "no colon here", 1000);
    updatePartial(s, ": missing speaker", 1000);
    updatePartial(s, "Prospect:   ", 1000);
    expect(getLiveTail(s, "", 1100)).toBe("");
  });

  it("sweeps stale entries on update — display-name churn cannot grow the map", () => {
    const s = createLiveTailState();
    updatePartial(s, "Old Name: something", 1000);
    updatePartial(s, "New Name: something else", 1000 + PARTIAL_FRESH_MS + 500);
    expect(s.bySpeaker.size).toBe(1);
    expect(s.bySpeaker.has("New Name")).toBe(true);
  });
});

describe("getLiveTail dedup (strict substring)", () => {
  const FINALS = "Prospect: So yeah I hear you.\nProspect: But honestly, I don't have the budget right now.";

  it("suppresses a stale/duplicate partial fully contained in the finals tail", () => {
    // The out-of-order case: a late duplicate partial re-arrives AFTER its
    // own final already landed in the buffer.
    const s = createLiveTailState();
    updatePartial(s, "Prospect: I don't have the budget right now", 1000);
    expect(getLiveTail(s, FINALS, 1200)).toBe("");
  });

  it("emits a partial with genuinely new words even when some words overlap", () => {
    // Partial overlap must NOT suppress — dropping new words silently
    // defeats the feature (the worse failure of the two).
    const s = createLiveTailState();
    updatePartial(s, "Prospect: the budget is honestly the least of my worries", 1000);
    const tail = getLiveTail(s, FINALS, 1200);
    expect(tail).toContain("least of my worries");
  });

  it("normalizes punctuation/case on both sides before comparing", () => {
    const s = createLiveTailState();
    updatePartial(s, "Prospect: i dont have the BUDGET right now", 1000);
    expect(getLiveTail(s, FINALS, 1200)).toBe("");
  });

  it("excludes stale partials from the tail", () => {
    const s = createLiveTailState();
    updatePartial(s, "Prospect: something totally new", 1000);
    expect(getLiveTail(s, FINALS, 1000 + PARTIAL_FRESH_MS + 1)).toBe("");
  });

  it("caps a runaway partial tail-kept", () => {
    const s = createLiveTailState();
    const monologue = "word ".repeat(300) + "the actual ending";
    updatePartial(s, `Prospect: ${monologue}`, 1000);
    const tail = getLiveTail(s, "", 1100);
    const text = tail.split(`${LIVE_TAIL_MARKER}: `)[1];
    expect(text.length).toBeLessThanOrEqual(LIVE_TAIL_MAX_CHARS);
    expect(text).toContain("the actual ending");
  });
});

describe("normalizeForMatch", () => {
  it("lowercases, strips punctuation, collapses whitespace, unifies contractions", () => {
    // "DON'T" and "dont" must land on the same token — Deepgram can render
    // a contraction either way between the partial and final passes.
    expect(normalizeForMatch("I DON'T   have, the budget!")).toBe("i dont have the budget");
    expect(normalizeForMatch("i dont have the budget")).toBe("i dont have the budget");
  });
});
