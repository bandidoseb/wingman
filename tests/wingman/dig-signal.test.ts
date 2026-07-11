/**
 * Unit tests — ↓ Dig Deeper card (4a.1 single-shot).
 *
 * Covers the trust boundaries: the belief-field decoder (drives the "DIG · PAIN" tag), the
 * shared user-segment builder (must degrade gracefully with no Belief Ladder — the common
 * state for the first ~2 min of every call), the taxonomy invariant that keeps the decoder
 * transparent, and streamDigCard's terminal contract (question / take-the-close / error)
 * driven by a mocked Anthropic SSE stream.
 */
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { decodeBeliefStream, decodeLineStream } from "../../src/lib/wingman/json-line-stream";
import { buildDigUserSegments, BELIEF_TAXONOMY } from "../../src/lib/wingman/dig-prompt.mjs";
import { streamDigCard, type DigStreamEvent } from "../../src/lib/wingman/dig-signal";

// ── decodeBeliefStream — the leading "belief" field ──────────────────────────
describe("decodeBeliefStream", () => {
  it("resolves the belief from a belief-first envelope", () => {
    const s = decodeBeliefStream('{"belief":"Pain","line":"what hurts?"}');
    expect(s.status).toBe("lever");
    if (s.status === "lever") expect(s.lever).toBe("Pain");
  });

  it("reports none when the line starts with no preceding belief", () => {
    // line reached without a belief key → definitively absent (belief was instructed first)
    expect(decodeBeliefStream('{"line":"what hurts?"}').status).toBe("none");
  });

  it("reports none for a null belief", () => {
    expect(decodeBeliefStream('{"belief":null,"line":null}').status).toBe("none");
  });

  it("holds pending until the belief value closes", () => {
    expect(decodeBeliefStream('{"belief":"Pai').status).toBe("pending");
  });

  it("char-by-char parity: final state matches the whole-buffer decode", () => {
    const full = '{"belief":"Desire","line":"what\'s the goal?"}';
    let last = decodeBeliefStream("");
    for (let i = 1; i <= full.length; i++) last = decodeBeliefStream(full.slice(0, i));
    expect(last.status).toBe("lever");
    if (last.status === "lever") expect(last.lever).toBe("Desire");
  });

  it("does not disturb decodeLineStream on a belief-first envelope", () => {
    // The line decoder finds "line" via its own key search — transparent to the belief prefix.
    const s = decodeLineStream('{"belief":"Trust","line":"why us?"}');
    expect(s.status).toBe("line");
    if (s.status === "line") expect(s.line).toBe("why us?");
  });
});

// ── Taxonomy invariant — decoder transparency ────────────────────────────────
describe("BELIEF_TAXONOMY", () => {
  it("has the 7 beliefs", () => {
    expect(BELIEF_TAXONOMY).toEqual(["Pain", "Doubt", "Cost", "Desire", "Money", "Support", "Trust"]);
  });
  it("no id contains the substring 'line' (would confuse decodeLineStream's key search)", () => {
    for (const b of BELIEF_TAXONOMY) expect(b.toLowerCase()).not.toContain("line");
  });
});

// ── buildDigUserSegments — graceful with no Belief Ladder ─────────────────────
describe("buildDigUserSegments", () => {
  it("falls back to an early-call note when there is no summary", () => {
    const segs = buildDigUserSegments({ liveSummary: undefined, latestResponse: "hi there" });
    expect(segs[0].text).toContain("no call memory yet");
    expect(segs[0].cache).toBe(true);
    expect(segs[1].text).toContain("hi there");
  });
  it("includes the belief ladder when present", () => {
    const segs = buildDigUserSegments({ liveSummary: "WEAKEST LINK → Pain", latestResponse: "x" });
    expect(segs[0].text).toContain("WEAKEST LINK → Pain");
  });
  it("tolerates a missing latestResponse", () => {
    const segs = buildDigUserSegments({ liveSummary: "s" });
    expect(segs[1].text).toContain("WHAT WAS JUST SAID");
  });

  // ── Phase 1b — Sales DNA layering + cache placement ─────────────────────────
  const COMPLETE_DNA = {
    transformation: "W2 to land deals", root_driver: "monthly cash flow",
    emotional_root: "freedom", guarantee: "90-day refund", syntax: "problems",
    pain: "can't scale", desire: "'quit my job' → cash flow", cost: "debt",
    doubt: "courses failed", trust: "we build it live", money: "asks about savings",
    support: "spouse",
  };

  it("no DNA → byte-identical legacy 2-segment shape (zero regression)", () => {
    const legacy = buildDigUserSegments({ liveSummary: "s", latestResponse: "x" });
    const explicit = buildDigUserSegments({ salesDna: undefined, liveSummary: "s", latestResponse: "x" });
    expect(explicit).toEqual(legacy);
    expect(legacy).toHaveLength(2);
    expect(legacy[0].cache).toBe(true); // breakpoint stays on the summary segment
  });

  it("partial DNA injects NOTHING (all-questions threshold)", () => {
    const segs = buildDigUserSegments({ salesDna: { pain: "only this" }, liveSummary: "s", latestResponse: "x" });
    expect(segs).toHaveLength(2);
    expect(segs[0].text).not.toContain("SALES DNA");
  });

  it("complete DNA → DNA segment FIRST + cached; summary segment no longer cached", () => {
    const segs = buildDigUserSegments({ salesDna: COMPLETE_DNA, liveSummary: "WEAKEST LINK → Desire", latestResponse: "x" });
    expect(segs).toHaveLength(3);
    expect(segs[0].text).toContain("SALES DNA");
    expect(segs[0].text).toContain("AVERAGES, NOT GOSPEL");          // fence rides inside
    expect(segs[0].text).toContain("NEVER state a number");          // dig-side fence
    expect(segs[0].cache).toBe(true);                                // the primed breakpoint
    expect(segs[1].text).toContain("WEAKEST LINK → Desire");
    expect(segs[1].cache).toBe(false);  // changes every ~2 min — no wasted cache writes
    expect(segs[2].cache).toBe(false);
  });

  it("DNA segment bytes are stable across calls (cache-key integrity)", () => {
    const a = buildDigUserSegments({ salesDna: COMPLETE_DNA, liveSummary: "s1", latestResponse: "x1" })[0].text;
    const b = buildDigUserSegments({ salesDna: COMPLETE_DNA, liveSummary: "s2", latestResponse: "x2" })[0].text;
    expect(a).toBe(b);
  });
});

// ── streamDigCard — terminal contract via a mocked Anthropic stream ──────────
/** Build a ReadableStream of Anthropic-style SSE frames from a full model output. */
function anthropicStream(fullText: string, chunkSize = 7): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const chunks: string[] = [];
  for (let i = 0; i < fullText.length; i += chunkSize) chunks.push(fullText.slice(i, i + chunkSize));
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) {
        const frame = `event: content_block_delta\ndata: ${JSON.stringify({ delta: { text: c } })}\n\n`;
        controller.enqueue(enc.encode(frame));
      }
      controller.close();
    },
  });
}

function mockFetch(fullText: string, ok = true) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok, body: ok ? anthropicStream(fullText) : null, status: ok ? 200 : 500, text: async () => "" })));
}

async function collect(gen: AsyncGenerator<DigStreamEvent>): Promise<DigStreamEvent[]> {
  const out: DigStreamEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe("streamDigCard", () => {
  const OLD_KEY = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => { process.env.ANTHROPIC_API_KEY = "test-key"; });
  afterEach(() => { vi.unstubAllGlobals(); });
  afterAll(() => { if (OLD_KEY === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = OLD_KEY; });

  it("emits belief → delta(s) → done for a real question", async () => {
    mockFetch('{"belief":"Pain","line":"what\'s the worst part?"}');
    const events = await collect(streamDigCard("prospect said stuff", "WEAKEST LINK → Pain"));
    const kinds = events.map((e) => e.kind);
    expect(kinds[0]).toBe("belief");
    expect(events[0]).toMatchObject({ kind: "belief", belief: "Pain" });
    expect(kinds).toContain("delta");
    const done = events.find((e) => e.kind === "done");
    expect(done).toMatchObject({ kind: "done", line: "what's the worst part?", belief: "Pain" });
  });

  it("emits a nudge (take-the-close) for { belief:null, line:null }", async () => {
    mockFetch('{"belief":null,"line":null}');
    const events = await collect(streamDigCard("they're ready", "all beliefs locked"));
    expect(events.some((e) => e.kind === "nudge")).toBe(true);
    expect(events.some((e) => e.kind === "delta")).toBe(false);
  });

  it("degrades an unknown belief to no tag but still streams the question", async () => {
    mockFetch('{"belief":"Vibes","line":"tell me more?"}');
    const events = await collect(streamDigCard("x", "s"));
    const belief = events.find((e) => e.kind === "belief");
    expect(belief).toMatchObject({ kind: "belief", belief: undefined });
    expect(events.some((e) => e.kind === "done")).toBe(true);
  });

  it("emits a single error for a truncated/unparseable envelope", async () => {
    mockFetch('{"belief":"Pain","line":"half a quest'); // never closes
    const events = await collect(streamDigCard("x", "s"));
    expect(events.filter((e) => e.kind === "error")).toHaveLength(1);
    expect(events.some((e) => e.kind === "done")).toBe(false);
  });

  it("emits a single error on a non-ok HTTP response", async () => {
    mockFetch("", false);
    const events = await collect(streamDigCard("x", "s"));
    expect(events).toEqual([{ kind: "error" }]);
  });

  it("errors (never throws) when the API key is missing", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const events = await collect(streamDigCard("x", "s"));
    expect(events).toEqual([{ kind: "error" }]);
    process.env.ANTHROPIC_API_KEY = saved;
  });
});
