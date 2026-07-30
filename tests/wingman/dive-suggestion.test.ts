/**
 * Unit tests — the Coach's pending call-suggestion lifecycle.
 *
 * The bug these guard against was a MONEY bug, not a UI bug. The clear-suggestion
 * call sat inside a branch that could never run (`diveReady.callData.id`, a field
 * the route never sends), so the suggestion never cleared. `pendingCallId` then
 * rode every later send → the model re-fired DIVE_NOW → each message re-read the
 * full call row plus the whole transcript and paid for another Sonnet call and
 * another daily-quota decrement.
 *
 * The asymmetry in the third test is the point: a transient failure MUST keep the
 * suggestion (or "try again" can never work), and a permanent one MUST drop it (or
 * the rep loops an expensive retry that can never succeed).
 */
import { describe, it, expect } from "vitest";
import { nextSuggestion, type CallSuggestion, type ChatDiveReady } from "../../src/lib/wingman/dive-suggestion";

const SUGGESTION: CallSuggestion = { call_id: "11111111-1111-4111-8111-111111111111", name: "Kathryn" };
const OTHER: CallSuggestion = { call_id: "22222222-2222-4222-8222-222222222222", name: "Marcus" };

describe("nextSuggestion", () => {
  it("clears after a successful dive — this is the leak that burned quota", () => {
    expect(nextSuggestion(SUGGESTION, {})).toBeNull();
  });

  it("KEEPS the suggestion on a transient failure so 'try again' can work", () => {
    expect(nextSuggestion(SUGGESTION, { diveFailed: true })).toEqual(SUGGESTION);
  });

  it("clears on an ordinary reply that offers nothing", () => {
    expect(nextSuggestion(SUGGESTION, { callSuggestion: null })).toBeNull();
  });

  it("ignores a suggestion with no call_id — that would send an id-less dive", () => {
    // The value arrives from an untyped res.json(). Without the call_id guard this
    // sets a suggestion whose id is undefined; JSON.stringify then DROPS
    // pendingCallId from the body, and the next 'dive in' lands in the no-id branch.
    const malformed = { name: "Kathryn" } as unknown as CallSuggestion;
    expect(nextSuggestion(SUGGESTION, { callSuggestion: malformed })).toBeNull();
  });

  it("replaces the suggestion when a new call is offered", () => {
    expect(nextSuggestion(SUGGESTION, { callSuggestion: OTHER })).toEqual(OTHER);
  });

  it("stays null when there was nothing and nothing is offered", () => {
    expect(nextSuggestion(null, {})).toBeNull();
  });

  it("a transient failure with no prior suggestion stays null — never invents one", () => {
    expect(nextSuggestion(null, { diveFailed: true })).toBeNull();
  });
});

/**
 * The wire contract. The original bug was NOT a logic error — it was the route
 * emitting one key name and the client reading another, with `res.json(): any`
 * between them, so it typechecked green while dead for its whole life.
 *
 * `ChatDiveReady` is now imported by BOTH ends, so this compile-time assertion is
 * the guard: rename a key in the route or the client and this stops compiling.
 * Typecheck is a required gate, so that failure is caught.
 */
describe("ChatDiveReady wire contract", () => {
  it("carries the key the client needs to open the call", () => {
    const payload: ChatDiveReady = {
      openerReply: "Read it. Your call with Kathryn…",
      callId: SUGGESTION.call_id,
      callData: { prospect_name: "Kathryn" },
    };
    // `callId` — not `callData.id`, which is what the dead branch read for months.
    expect(payload.callId).toBe(SUGGESTION.call_id);
  });
});
