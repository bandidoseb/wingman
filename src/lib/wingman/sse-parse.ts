/**
 * sse-parse.ts — pure, incremental Server-Sent-Events frame parser.
 *
 * The objection card streams over SSE (text/event-stream). `fetch().body` hands us bytes
 * in arbitrary chunks that DON'T align to event boundaries — a single read can contain half
 * a frame, or three frames, or a frame split across two reads. This parser is the trust
 * boundary: feed it the running buffer, it returns whatever COMPLETE events are present and
 * the leftover partial frame to prepend next time. Pure (no I/O) so it's fully unit-tested.
 *
 * SSE framing (W3C EventSource): events separated by a blank line; within a frame, `field:
 * value` lines; a leading space after the colon is stripped; multiple `data:` lines join
 * with "\n"; a line starting with ":" is a comment (ignored — e.g. our `: ok` proxy flush).
 * An event with no `event:` field defaults to type "message".
 */

export interface SSEEvent {
  event: string;
  data: string;
}

export interface ParseResult {
  events: SSEEvent[];
  rest: string;
}

/** Parse one frame's text (no trailing blank line). Returns null if it carries no data. */
function parseFrame(frame: string): SSEEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  let sawField = false;

  for (const rawLine of frame.split(/\r?\n/)) {
    if (rawLine === "" || rawLine.startsWith(":")) continue; // blank or comment
    const colon = rawLine.indexOf(":");
    const field = colon === -1 ? rawLine : rawLine.slice(0, colon);
    let value = colon === -1 ? "" : rawLine.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1); // strip ONE leading space

    if (field === "event") { event = value; sawField = true; }
    else if (field === "data") { dataLines.push(value); sawField = true; }
    // other fields (id, retry) are valid SSE but unused here — ignore.
  }

  if (!sawField) return null; // comment-only / empty frame → no event
  return { event, data: dataLines.join("\n") };
}

/**
 * Extract all complete events from `buffer`; return them plus the unparsed remainder.
 * Call as: buffer += chunk; const { events, rest } = parseSSEBuffer(buffer); buffer = rest;
 */
export function parseSSEBuffer(buffer: string): ParseResult {
  const events: SSEEvent[] = [];
  let rest = buffer;

  // Frames are delimited by a blank line: \n\n (tolerate \r\n\r\n).
  while (true) {
    const m = rest.match(/\r?\n\r?\n/);
    if (!m || m.index === undefined) break;
    const frame = rest.slice(0, m.index);
    rest = rest.slice(m.index + m[0].length);
    const ev = parseFrame(frame);
    if (ev) events.push(ev);
  }

  return { events, rest };
}
