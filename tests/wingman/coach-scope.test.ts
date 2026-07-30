import { describe, it, expect } from "vitest";
import {
  GLOBAL_SCOPE,
  INITIAL_SCOPE,
  resolveScope,
  onDerivedChange,
  onDive,
  dismissScope,
  type ScopeState,
// Relative, not `@/…` — vitest.config.ts registers no path alias on purpose.
} from "../../src/lib/wingman/coach-scope";
import * as scopeModule from "../../src/lib/wingman/coach-scope";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("resolveScope", () => {
  it("is global with nothing set", () => {
    expect(resolveScope(INITIAL_SCOPE)).toBe(GLOBAL_SCOPE);
  });

  it("follows the call Flight Log has open", () => {
    expect(resolveScope({ ...INITIAL_SCOPE, derived: A })).toBe(A);
  });

  it("lets a dive outrank the open call", () => {
    expect(resolveScope({ override: B, derived: A, dismissedDerived: null })).toBe(B);
  });

  it("ignores a derived call the rep dismissed", () => {
    expect(resolveScope({ override: null, derived: A, dismissedDerived: A })).toBe(GLOBAL_SCOPE);
  });
});

describe("onDerivedChange", () => {
  it("drops a dive override when a DIFFERENT call is opened", () => {
    const s = onDerivedChange({ override: A, derived: null, dismissedDerived: null }, B);
    expect(s.override).toBeNull();
    expect(resolveScope(s)).toBe(B);
  });

  it("keeps the override when the dive's OWN navigation lands", () => {
    // The dive sets override=A, then routes to Flight Log, which reports derived=A.
    const s = onDerivedChange({ override: A, derived: null, dismissedDerived: null }, A);
    expect(s.override).toBe(A);
    expect(resolveScope(s)).toBe(A);
  });

  it("keeps the override across a tab change (derived → null)", () => {
    // FlightLogTab unmounts on every tab switch and reports null in its cleanup.
    const s = onDerivedChange({ override: A, derived: A, dismissedDerived: null }, null);
    expect(s.override).toBe(A);
    expect(resolveScope(s)).toBe(A);
  });

  it("returns the SAME object when nothing changed, so React can bail out", () => {
    const before: ScopeState = { override: null, derived: A, dismissedDerived: null };
    expect(onDerivedChange(before, A)).toBe(before);
  });
});

describe("dismissScope", () => {
  it("makes ✕ actually stick while the call stays open", () => {
    const s = dismissScope({ override: null, derived: A, dismissedDerived: null });
    expect(resolveScope(s)).toBe(GLOBAL_SCOPE);
    // ...and it stays global while that same call is still on screen.
    expect(resolveScope(onDerivedChange(s, A))).toBe(GLOBAL_SCOPE);
  });

  it("re-scopes when the rep leaves the call and comes back", () => {
    let s = dismissScope({ override: null, derived: A, dismissedDerived: null });
    s = onDerivedChange(s, null); // back to the list
    s = onDerivedChange(s, A);    // reopened
    expect(resolveScope(s)).toBe(A);
  });

  it("re-scopes when a different call is opened", () => {
    let s = dismissScope({ override: null, derived: A, dismissedDerived: null });
    s = onDerivedChange(s, B);
    expect(resolveScope(s)).toBe(B);
  });

  it("drops a dive override too", () => {
    const s = dismissScope({ override: B, derived: null, dismissedDerived: null });
    expect(resolveScope(s)).toBe(GLOBAL_SCOPE);
  });
});

describe("onDive", () => {
  it("scopes to the dived call", () => {
    expect(resolveScope(onDive(INITIAL_SCOPE, A))).toBe(A);
  });

  it("beats an earlier dismissal of that same call", () => {
    const s = onDive({ override: null, derived: A, dismissedDerived: A }, A);
    expect(resolveScope(s)).toBe(A);
  });
});

describe("New chat does NOT touch scope", () => {
  /*
    The plan had "New chat" drop the dive override. It was dropped from the design
    because it costs the rep data: changing the visible scope means New chat has to
    clear the LANDING thread too, so "start over on this call" would also wipe the
    global thread and its 24h localStorage entry. There is deliberately no scope
    reducer for New chat — the chip's ✕ (`dismissScope`) is the only way out.
  */
  it("exposes no New-chat scope transition", () => {
    // A guard against re-adding one without re-reading the note above.
    expect("onNewChat" in scopeModule).toBe(false);
  });

  it("leaves ✕ as the only exit from a dive scope", () => {
    const dived = onDive(INITIAL_SCOPE, A);
    expect(resolveScope(dived)).toBe(A);
    expect(resolveScope(dismissScope(dived))).toBe(GLOBAL_SCOPE);
  });
});
