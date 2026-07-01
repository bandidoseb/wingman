/**
 * Unit tests — parseSSEBuffer (objection card SSE framing).
 *
 * fetch().body delivers bytes in arbitrary chunks. The parser must surface only COMPLETE
 * events and carry the partial frame forward in `rest`. (Plan review W9 + Step 4 plan.)
 */
import { describe, it, expect } from "vitest";
import { parseSSEBuffer } from "../../src/lib/wingman/sse-parse";

describe("parseSSEBuffer", () => {
  it("parses a single complete event", () => {
    const { events, rest } = parseSSEBuffer('event: delta\ndata: {"textSoFar":"Hi"}\n\n');
    expect(events).toEqual([{ event: "delta", data: '{"textSoFar":"Hi"}' }]);
    expect(rest).toBe("");
  });

  it("parses multiple events in one buffer", () => {
    const buf = "event: delta\ndata: a\n\nevent: delta\ndata: b\n\nevent: done\ndata: {}\n\n";
    const { events, rest } = parseSSEBuffer(buf);
    expect(events.map((e) => e.event)).toEqual(["delta", "delta", "done"]);
    expect(events.map((e) => e.data)).toEqual(["a", "b", "{}"]);
    expect(rest).toBe("");
  });

  it("leaves an incomplete trailing frame in rest", () => {
    const { events, rest } = parseSSEBuffer("event: delta\ndata: a\n\nevent: del");
    expect(events).toEqual([{ event: "delta", data: "a" }]);
    expect(rest).toBe("event: del");
  });

  it("reassembles a frame split across two reads", () => {
    let buffer = "event: del";
    let r1 = parseSSEBuffer(buffer);
    expect(r1.events).toEqual([]);
    buffer = r1.rest + 'ta\ndata: {"x":1}\n\n';
    let r2 = parseSSEBuffer(buffer);
    expect(r2.events).toEqual([{ event: "delta", data: '{"x":1}' }]);
    expect(r2.rest).toBe("");
  });

  it("handles a split sentinel (\\n arrives, then \\n)", () => {
    let buffer = "event: done\ndata: {}\n";
    let r1 = parseSSEBuffer(buffer);
    expect(r1.events).toEqual([]); // only one newline so far — frame not closed
    buffer = r1.rest + "\n";
    let r2 = parseSSEBuffer(buffer);
    expect(r2.events).toEqual([{ event: "done", data: "{}" }]);
  });

  it("ignores a comment-only frame (the : ok proxy flush)", () => {
    const { events, rest } = parseSSEBuffer(": ok\n\nevent: delta\ndata: x\n\n");
    expect(events).toEqual([{ event: "delta", data: "x" }]);
    expect(rest).toBe("");
  });

  it("defaults event type to message when no event field", () => {
    const { events } = parseSSEBuffer("data: hello\n\n");
    expect(events).toEqual([{ event: "message", data: "hello" }]);
  });

  it("joins multiple data lines with newline", () => {
    const { events } = parseSSEBuffer("data: line1\ndata: line2\n\n");
    expect(events).toEqual([{ event: "message", data: "line1\nline2" }]);
  });

  it("strips exactly one leading space after the colon", () => {
    const { events } = parseSSEBuffer("data:  two-leading\n\n"); // two spaces → one stripped
    expect(events[0].data).toBe(" two-leading");
  });

  it("tolerates CRLF line endings", () => {
    const { events, rest } = parseSSEBuffer("event: delta\r\ndata: a\r\n\r\n");
    expect(events).toEqual([{ event: "delta", data: "a" }]);
    expect(rest).toBe("");
  });
});
