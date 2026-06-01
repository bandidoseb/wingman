import { describe, it, expect } from "vitest";
import {
  buildRepProfile,
  buildObjectionVaultSummary,
  buildSignalVaultSummary,
} from "../../src/lib/wingman/rep-profile";
import type { Profile, Outcome, VaultObjection, VaultSignal } from "../../src/types";

function makeProfile(partial: Partial<Profile> = {}): Profile {
  return {
    id: "u",
    email: "rep@example.com",
    role: "closer",
    sales_style: null,
    call_length: null,
    activation_key: null,
    onboarding_step: "complete",
    onboarding_complete: true,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: null,
    subscription_plan: null,
    alert_pitching_early: true,
    alert_missed_topics: true,
    alert_post_call_debrief: true,
    alert_weekly_summary: true,
    assist_enabled: true,
    signal_display_mode: "full",
    ai_model_preference: "smart",
    calls_used: 0,
    extra_calls_remaining: 0,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

function calls(outcomes: Array<Outcome | null>): Array<{ outcome: Outcome | null }> {
  return outcomes.map((o) => ({ outcome: o }));
}

function vobj(partial: Partial<VaultObjection>): VaultObjection {
  return {
    id: "x", user_id: "u", objection: "", frequency: 0,
    handle1: null, handle2: null, is_new: false,
    created_at: "", updated_at: "",
    ...partial,
  };
}

function vsig(partial: Partial<VaultSignal>): VaultSignal {
  return {
    id: "x", user_id: "u", stage: "Discovery", stage_color: null,
    header: "h", trigger: null, text: null, is_enabled: true,
    is_new: false, display_order: 0, created_at: "", updated_at: "",
    ...partial,
  };
}

describe("buildRepProfile — close-rate math", () => {
  it("excludes DQ calls from the close-rate denominator", () => {
    // 2 closed, 2 lost, 1 DQ -> denominator excludes the DQ -> 2/4 = 50%
    const out = buildRepProfile({
      profile: makeProfile(),
      offerName: "Coaching",
      offerPrice: "$5k",
      recentCalls: calls(["Closed", "Closed", "Lost", "Lost", "DQ"]),
      objections: [],
      signals: [],
    });
    expect(out).toContain("Close rate: 50%");
    expect(out).toContain("2 closed / 2 lost / 1 DQ");
  });

  it("reports 0% close rate with no calls (no divide-by-zero)", () => {
    const out = buildRepProfile({
      profile: makeProfile(),
      offerName: null,
      offerPrice: null,
      recentCalls: [],
      objections: [],
      signals: [],
    });
    expect(out).toContain("Close rate: 0%");
    expect(out).toContain("Offer: Not set");
  });

  it("only counts the most recent 30 calls", () => {
    const many = calls(Array(40).fill("Closed"));
    const out = buildRepProfile({
      profile: makeProfile(),
      offerName: "X", offerPrice: null,
      recentCalls: many, objections: [], signals: [],
    });
    expect(out).toContain("Stats (last 30 calls)");
  });

  it("raises a loss-rate pattern flag when loss rate exceeds 40%", () => {
    const out = buildRepProfile({
      profile: makeProfile(),
      offerName: "X", offerPrice: null,
      recentCalls: calls(["Lost", "Lost", "Lost", "Closed"]), // 75% lost
      objections: [], signals: [],
    });
    expect(out).toMatch(/Pattern flags:.*loss rate/);
  });
});

describe("buildRepProfile — field assembly & JSON-parse resilience", () => {
  it("surfaces top 3 objections by frequency, highest first", () => {
    const out = buildRepProfile({
      profile: makeProfile(),
      offerName: "X", offerPrice: null, recentCalls: [],
      objections: [
        vobj({ objection: "price", frequency: 5 }),
        vobj({ objection: "spouse", frequency: 9 }),
        vobj({ objection: "timing", frequency: 1 }),
        vobj({ objection: "trust", frequency: 7 }),
      ],
      signals: [],
    });
    // top 3 by frequency: spouse(9), trust(7), price(5) — timing(1) excluded
    expect(out).toContain("spouse, trust, price");
    expect(out).not.toContain("timing");
  });

  it("does not throw on malformed JSON fields (call_weakness etc.)", () => {
    expect(() =>
      buildRepProfile({
        profile: makeProfile({ call_weakness: "{not json", lead_source: "also bad" }),
        offerName: "X", offerPrice: null, recentCalls: [], objections: [], signals: [],
      })
    ).not.toThrow();
  });

  it("maps known weakness codes to human labels", () => {
    const out = buildRepProfile({
      profile: makeProfile({ call_weakness: JSON.stringify(["fold_price"]) }),
      offerName: "X", offerPrice: null, recentCalls: [], objections: [], signals: [],
    });
    expect(out).toContain("folds on price");
  });
});

describe("buildObjectionVaultSummary", () => {
  it("returns the empty marker when there are no objections", () => {
    expect(buildObjectionVaultSummary([])).toBe("OBJECTION VAULT: (empty)");
  });

  it("uses a handle when present and a placeholder when not", () => {
    const out = buildObjectionVaultSummary([
      vobj({ objection: "too pricey", handle1: "reframe ROI" }),
      vobj({ objection: "no time", handle1: null, handle2: null }),
    ]);
    expect(out).toContain('"too pricey" → reframe ROI');
    expect(out).toContain('"no time" → (no handle set)');
  });
});

describe("buildSignalVaultSummary", () => {
  it("returns the empty marker when no signals are enabled", () => {
    expect(buildSignalVaultSummary([vsig({ is_enabled: false })])).toBe("SIGNAL VAULT: (empty)");
  });

  it("includes only enabled signals and counts them", () => {
    const out = buildSignalVaultSummary([
      vsig({ header: "On price", is_enabled: true }),
      vsig({ header: "Disabled one", is_enabled: false }),
    ]);
    expect(out).toContain("1 active signals");
    expect(out).toContain("On price");
    expect(out).not.toContain("Disabled one");
  });
});
