/**
 * Unit tests — the `single_call` coach payload.
 *
 * `transcriptStatus` is the field that decides whether Wingman says "here's what
 * happened", "nothing was captured on this call", or "it may still be saving". Get
 * it wrong and the coach DENIES A REAL CALL HAPPENED — which already shipped once,
 * when a change dropped transcripts from the dashboard query and an empty array
 * silently changed meaning from "nothing was said" to "not loaded yet".
 *
 * The rule: "empty" is a PROVEN absence. Never assert it from ignorance.
 */
import { describe, it, expect } from "vitest";
import { buildSingleCallPayload, transcriptStatusFor } from "../../src/lib/wingman/coach-payload";
import type { Call } from "../../src/types";

const ID = "11111111-1111-4111-8111-111111111111";
const ROW = { id: "row-1", call_id: ID, speaker: "You", text: "Hello", sequence_order: 1 };

const call = (over: Partial<Call> = {}): Call =>
  ({ id: ID, prospect_name: "Kathryn", call_transcript: null, ...over }) as unknown as Call;

const NONE: ReadonlySet<string> = new Set();

describe("transcriptStatusFor", () => {
  it("present when we actually have rows", () => {
    expect(transcriptStatusFor(ID, { rows: [ROW], provisional: false }, NONE, [ROW])).toBe("present");
  });

  it("UNKNOWN when nothing has been fetched — never 'empty'", () => {
    // The list rows carry no transcript, so this is the default state. Reporting it
    // as "empty" is how the coach ends up denying a call that really happened.
    expect(transcriptStatusFor(ID, undefined, NONE, [])).toBe("unknown");
  });

  it("UNKNOWN when the fetch was provisional — its emptiness proves nothing", () => {
    // Rows flush every ~25s; a fetch racing the final flush can miss the tail.
    expect(transcriptStatusFor(ID, { rows: [], provisional: true }, NONE, [])).toBe("unknown");
  });

  it("empty when a SETTLED fetch came back with zero rows", () => {
    expect(transcriptStatusFor(ID, { rows: [], provisional: false }, NONE, [])).toBe("empty");
  });

  it("empty when the SERVER confirmed no debrief, even if the cache is provisional", () => {
    // The only proof available on this path: a call with no transcript never gets a
    // summary, so its cache entry stays provisional forever.
    expect(transcriptStatusFor(ID, { rows: [], provisional: true }, new Set([ID]), [])).toBe("empty");
  });
});

describe("buildSingleCallPayload", () => {
  it("grafts the fetched transcript onto the call", () => {
    // Without this the route builds its TRANSCRIPT block from nothing and Wingman
    // silently coaches from the 150-char summary alone.
    const out = buildSingleCallPayload(call(), { rows: [ROW], provisional: false }, NONE);
    expect(out.call.call_transcript).toEqual([ROW]);
    expect(out.transcriptStatus).toBe("present");
  });

  it("falls back to rows already on the call row", () => {
    const out = buildSingleCallPayload(call({ call_transcript: [ROW] }), undefined, NONE);
    expect(out.call.call_transcript).toEqual([ROW]);
    expect(out.transcriptStatus).toBe("present");
  });

  it("reports unknown — not empty — for a call nobody has opened", () => {
    const out = buildSingleCallPayload(call(), undefined, NONE);
    expect(out.call.call_transcript).toEqual([]);
    expect(out.transcriptStatus).toBe("unknown");
  });

  it("does not mutate the call it was given", () => {
    const original = call();
    buildSingleCallPayload(original, { rows: [ROW], provisional: false }, NONE);
    expect(original.call_transcript).toBeNull();
  });
});
