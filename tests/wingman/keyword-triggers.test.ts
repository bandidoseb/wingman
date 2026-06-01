import { describe, it, expect } from "vitest";
import { checkKeywordTriggers, KEYWORD_TRIGGERS } from "../../src/lib/wingman/keyword-triggers";
import type { VaultObjection } from "../../src/types";

// Full, type-correct VaultObjection factory (tests/ is typechecked by the gate).
function obj(partial: Partial<VaultObjection>): VaultObjection {
  return {
    id: "x",
    user_id: "u",
    objection: "",
    frequency: 0,
    handle1: null,
    handle2: null,
    is_new: false,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("checkKeywordTriggers — matching", () => {
  it("fires on a prospect price objection", () => {
    const sig = checkKeywordTriggers("Prospect: honestly this is too expensive for me", [], "Rep");
    expect(sig).not.toBeNull();
    expect(sig?.type).toBe("Handle");
    expect(sig?.source).toBe("keyword");
    expect(sig?.header).toBe("If price wasn't a factor?");
  });

  it("returns null when nothing matches", () => {
    expect(checkKeywordTriggers("Prospect: this sounds great, let's do it", [], "Rep")).toBeNull();
  });

  it("returns null on empty / colon-less text", () => {
    expect(checkKeywordTriggers("", [], "Rep")).toBeNull();
    expect(checkKeywordTriggers("no speaker label here", [], "Rep")).toBeNull();
  });

  it("is case-insensitive", () => {
    const sig = checkKeywordTriggers("Prospect: I NEED TO THINK ABOUT IT", [], null);
    expect(sig?.header).toBe("What's in the way?");
  });
});

describe("checkKeywordTriggers — rep-speaker exclusion (the critical bug guard)", () => {
  it("does NOT fire when the trigger phrase is spoken by the rep", () => {
    // The rep saying "too expensive" must never fire a card.
    const sig = checkKeywordTriggers("Rep: a lot of people feel it's too expensive at first", [], "Rep");
    expect(sig).toBeNull();
  });

  it("fires only on the prospect's line when both speak", () => {
    const chunk = "Rep: tell me more about the budget\nProspect: it's just too expensive right now";
    const sig = checkKeywordTriggers(chunk, [], "Rep");
    expect(sig).not.toBeNull();
    expect(sig?.header).toBe("If price wasn't a factor?");
  });

  it("matches rep label case-insensitively", () => {
    const sig = checkKeywordTriggers("REP: it's too expensive for some", [], "Rep");
    expect(sig).toBeNull();
  });

  it("checks all lines when repSpeaker is null (first chunk not yet seen)", () => {
    const sig = checkKeywordTriggers("Someone: I can't afford that", [], null);
    expect(sig).not.toBeNull();
  });
});

describe("checkKeywordTriggers — vault handle preference", () => {
  it("uses the vault handle1 text when a matching objection has one", () => {
    const vault = [obj({ objection: "price too high", handle1: "Custom price handle" })];
    const sig = checkKeywordTriggers("Prospect: too expensive", vault, "Rep");
    expect(sig?.text).toBe("Custom price handle");
    // header still comes from the trigger, not the vault
    expect(sig?.header).toBe("If price wasn't a factor?");
  });

  it("falls back to handle2 when handle1 is empty", () => {
    const vault = [obj({ objection: "price", handle1: null, handle2: "Second handle" })];
    const sig = checkKeywordTriggers("Prospect: too expensive", vault, "Rep");
    expect(sig?.text).toBe("Second handle");
  });

  it("falls back to the trigger's default when vault match has no handles", () => {
    const vault = [obj({ objection: "price", handle1: null, handle2: null })];
    const sig = checkKeywordTriggers("Prospect: too expensive", vault, "Rep");
    expect(sig?.text).toContain("If price wasn't a factor");
  });
});

describe("KEYWORD_TRIGGERS data integrity", () => {
  it("every trigger has patterns, a header, a fallback handle, and an objectionKey", () => {
    for (const t of KEYWORD_TRIGGERS) {
      expect(t.patterns.length).toBeGreaterThan(0);
      expect(t.fallbackHeader.length).toBeGreaterThan(0);
      expect(t.fallbackHandle.length).toBeGreaterThan(0);
      expect(t.objectionKey.length).toBeGreaterThan(0);
    }
  });

  it("all patterns are lowercase (matching relies on it)", () => {
    for (const t of KEYWORD_TRIGGERS) {
      for (const p of t.patterns) expect(p).toBe(p.toLowerCase());
    }
  });
});
