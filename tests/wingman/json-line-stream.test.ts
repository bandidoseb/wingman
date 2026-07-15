/**
 * Unit tests — decodeLineStream (objection card streaming JSON decoder).
 *
 * This is the trust boundary between Sonnet's arbitrarily-chunked stream and the
 * characters painted on screen. The decoder is fed the FULL accumulated buffer each
 * time and must never surface a half-resolved escape, must hold until line-vs-null is
 * known, and must classify empty/whitespace strings as abstain. (Plan review BLOCKER 2/3.)
 *
 * Key invariant under test: feeding the buffer one character at a time must never produce
 * a different final result than feeding it whole, and must never emit a broken partial.
 */
import { describe, it, expect } from "vitest";
import { decodeLineStream, type DecodeState } from "../../src/lib/wingman/json-line-stream";

/** Drive the decoder one char at a time; return every state it passes through. */
function driveCharByChar(full: string): DecodeState[] {
  const states: DecodeState[] = [];
  for (let i = 1; i <= full.length; i++) {
    states.push(decodeLineStream(full.slice(0, i)));
  }
  return states;
}

describe("decodeLineStream — final result", () => {
  it("decodes a normal line", () => {
    expect(decodeLineStream('{"line":"What makes you hesitant?"}'))
      .toEqual({ status: "line", line: "What makes you hesitant?" });
  });

  it("trims surrounding whitespace at close", () => {
    expect(decodeLineStream('{"line":"  Tell me more  "}'))
      .toEqual({ status: "line", line: "Tell me more" });
  });

  it("null → abstain", () => {
    expect(decodeLineStream('{"line":null}')).toEqual({ status: "abstain" });
  });

  it("empty string → abstain", () => {
    expect(decodeLineStream('{"line":""}')).toEqual({ status: "abstain" });
  });

  it("whitespace-only string → abstain", () => {
    expect(decodeLineStream('{"line":"   "}')).toEqual({ status: "abstain" });
  });

  it("tolerates spaces around the colon", () => {
    expect(decodeLineStream('{ "line" : "Hi" }')).toEqual({ status: "line", line: "Hi" });
  });

  it("ignores trailing prose after the closing quote", () => {
    expect(decodeLineStream('{"line":"Just say this"} and here is why...'))
      .toEqual({ status: "line", line: "Just say this" });
  });

  it("tolerates a leading markdown fence", () => {
    expect(decodeLineStream('```json\n{"line":"Fenced line"}\n```'))
      .toEqual({ status: "line", line: "Fenced line" });
  });
});

describe("decodeLineStream — escapes", () => {
  it("handles an escaped quote inside the line", () => {
    expect(decodeLineStream('{"line":"He said \\"no\\" twice"}'))
      .toEqual({ status: "line", line: 'He said "no" twice' });
  });

  it("handles \\n and \\t escapes", () => {
    expect(decodeLineStream('{"line":"a\\nb\\tc"}'))
      .toEqual({ status: "line", line: "a\nb\tc" });
  });

  it("handles a \\uXXXX unicode escape", () => {
    expect(decodeLineStream('{"line":"caf\\u00e9"}'))
      .toEqual({ status: "line", line: "café" });
  });

  it("errors on an invalid escape", () => {
    expect(decodeLineStream('{"line":"bad\\xescape"}')).toEqual({ status: "error" });
  });

  it("errors on a non-hex unicode escape", () => {
    expect(decodeLineStream('{"line":"\\uZZZZ"}')).toEqual({ status: "error" });
  });
});

describe("decodeLineStream — char-by-char never breaks", () => {
  it("never emits a half escaped-quote (\\\" split across reads)", () => {
    const full = '{"line":"He said \\"hi\\""}';
    for (const s of driveCharByChar(full)) {
      // A streaming text must never end mid-escape with a lone backslash or stray quote
      // that would later be reinterpreted. The decoder holds, so text is always clean.
      if (s.status === "streaming") expect(s.text.endsWith("\\")).toBe(false);
    }
    expect(decodeLineStream(full)).toEqual({ status: "line", line: 'He said "hi"' });
  });

  it("holds a \\uXXXX split across reads (never paints a partial escape)", () => {
    const full = '{"line":"caf\\u00e9!"}';
    const texts = driveCharByChar(full)
      .filter((s): s is { status: "streaming"; text: string } => s.status === "streaming")
      .map((s) => s.text);
    // No intermediate text should contain a stray backslash-u fragment.
    for (const t of texts) expect(/\\u?[0-9a-fA-F]{0,3}$/.test(t)).toBe(false);
    // Once resolved, the accented char appears.
    expect(texts.some((t) => t.includes("café"))).toBe(true);
    expect(decodeLineStream(full)).toEqual({ status: "line", line: "café!" });
  });

  it("text is monotonic (only grows) char by char", () => {
    const full = '{"line":"Walk me through that"}';
    let prevLen = 0;
    for (const s of driveCharByChar(full)) {
      if (s.status === "streaming") {
        expect(s.text.length).toBeGreaterThanOrEqual(prevLen);
        prevLen = s.text.length;
      }
    }
  });

  it("stays pending until a non-whitespace char resolves (no empty open)", () => {
    // While only the key/colon/opening-quote/leading-spaces have arrived, never 'streaming'.
    const prefixes = ['{', '{"line"', '{"line":', '{"line":"', '{"line":" ', '{"line":"  '];
    for (const p of prefixes) {
      const s = decodeLineStream(p);
      expect(s.status === "streaming").toBe(false);
    }
    // First real char → streaming.
    expect(decodeLineStream('{"line":"  H')).toEqual({ status: "streaming", text: "H" });
  });

  it("holds on a partial null (n / nu / nul) then abstains", () => {
    expect(decodeLineStream('{"line":n').status).toBe("pending");
    expect(decodeLineStream('{"line":nul').status).toBe("pending");
    expect(decodeLineStream('{"line":null').status).toBe("abstain");
  });

  it("a trailing backslash at end of stream is held, not emitted", () => {
    // max_tokens cut the stream mid-escape — the lone backslash must not surface.
    const s = decodeLineStream('{"line":"almost\\');
    expect(s.status).toBe("streaming");
    if (s.status === "streaming") expect(s.text).toBe("almost");
  });
});

describe("decodeLineStream — structural errors", () => {
  it("pending before the key arrives", () => {
    expect(decodeLineStream('{"li')).toEqual({ status: "pending" });
  });

  it("errors on a non-string non-null value (number)", () => {
    expect(decodeLineStream('{"line":42}')).toEqual({ status: "error" });
  });

  it("errors on a wrong literal (nope)", () => {
    expect(decodeLineStream('{"line":nope}')).toEqual({ status: "error" });
  });
});

// ── B4: decodeLeverStream + lever-prefixed envelope transparency ─────────────────
import { decodeLeverStream } from "../../src/lib/wingman/json-line-stream";
import { LEVER_TAXONOMY } from "../../src/lib/wingman/objection-prompt.mjs";

describe("B4 — lever-prefixed envelope", () => {
  const LEVERED = '{"lever":"financial-trade","line":"Money aside, you in?"}';

  it("decodeLineStream is transparent to a leading lever field (whole + char-by-char)", () => {
    expect(decodeLineStream(LEVERED)).toEqual({ status: "line", line: "Money aside, you in?" });
    const states = driveCharByChar(LEVERED);
    expect(states[states.length - 1]).toEqual({ status: "line", line: "Money aside, you in?" });
    // No state ever surfaces lever-value text as line text.
    for (const s of states) {
      if (s.status === "streaming") expect(s.text.includes("financial")).toBe(false);
    }
  });

  it("lever-prefixed abstain still resolves as abstain", () => {
    expect(decodeLineStream('{"lever":"why-probe","line":null}')).toEqual({ status: "abstain" });
    expect(decodeLineStream('{"lever":null,"line":null}')).toEqual({ status: "abstain" });
  });

  it("decodeLeverStream resolves the lever before the line starts (char-by-char)", () => {
    let leverAt = -1, lineStartAt = -1;
    for (let i = 1; i <= LEVERED.length; i++) {
      const buf = LEVERED.slice(0, i);
      if (leverAt === -1 && decodeLeverStream(buf).status === "lever") leverAt = i;
      if (lineStartAt === -1 && decodeLineStream(buf).status !== "pending") lineStartAt = i;
    }
    expect(leverAt).toBeGreaterThan(0);
    expect(lineStartAt).toBeGreaterThan(0);
    expect(leverAt).toBeLessThan(lineStartAt); // guard decision available pre-paint
    expect(decodeLeverStream(LEVERED)).toEqual({ status: "lever", lever: "financial-trade" });
  });

  it("no lever → 'none' the moment the line resolves (degrade-to-no-guard signal)", () => {
    expect(decodeLeverStream('{"line":"hi"}')).toEqual({ status: "none" });
    expect(decodeLeverStream('{"li')).toEqual({ status: "pending" });
    expect(decodeLeverStream('{"lever":null,"line":"hi"}')).toEqual({ status: "none" });
    expect(decodeLeverStream('{"lever":12,"line":"hi"}')).toEqual({ status: "none" });
  });

  it("taxonomy-collision invariant: no lever id's JSON rendering contains '\"line\"'", () => {
    for (const id of LEVER_TAXONOMY) {
      expect(`"lever":"${id}"`.includes('"line"')).toBe(false);
    }
  });
});

// ── Wrapping-quote strip (design language: the spoken line never renders in quotes) ──
// Root cause is the prompt fence; this decoder strip is the belt. The model wraps the line
// by emitting escaped quotes INSIDE the JSON string: {"line":"\"...\""} → decodes to "...".
import { stripWrappingQuotes } from "../../src/lib/wingman/json-line-stream";

describe("stripWrappingQuotes (pure helper)", () => {
  it("strips one balanced straight-quote pair", () => {
    expect(stripWrappingQuotes('"can I share a perspective?"')).toBe("can I share a perspective?");
  });
  it("strips a balanced curly-quote pair", () => {
    expect(stripWrappingQuotes("“what's really going on?”")).toBe("what's really going on?");
  });
  it("leaves an unwrapped line untouched (byte-identical)", () => {
    expect(stripWrappingQuotes("what's really going on?")).toBe("what's really going on?");
  });
  it("preserves a line that only ENDS in a quoted phrase (not a wrap)", () => {
    expect(stripWrappingQuotes('you literally said "too expensive"'))
      .toBe('you literally said "too expensive"');
  });
  it("preserves an internal quote", () => {
    expect(stripWrappingQuotes('so the "real" reason is what?')).toBe('so the "real" reason is what?');
  });
  it("only strips ONE pair", () => {
    expect(stripWrappingQuotes('""double""')).toBe('"double"');
  });
});

describe("decodeLineStream — wrapping quotes", () => {
  it("final: unwraps a fully-quoted line", () => {
    expect(decodeLineStream('{"line":"\\"can I share a perspective?\\""}'))
      .toEqual({ status: "line", line: "can I share a perspective?" });
  });
  it("final: a line that is only quotes → abstain, never a blank card", () => {
    expect(decodeLineStream('{"line":"\\"\\""}')).toEqual({ status: "abstain" });
  });
  it("final: no quotes → byte-identical to before", () => {
    expect(decodeLineStream('{"line":"What makes you hesitant?"}'))
      .toEqual({ status: "line", line: "What makes you hesitant?" });
  });
  it("final: preserves a line ending in a legit quoted phrase", () => {
    expect(decodeLineStream('{"line":"you said \\"too expensive\\""}'))
      .toEqual({ status: "line", line: 'you said "too expensive"' });
  });
  it("streaming: a lone opening quote so far stays pending (no bare-quote card)", () => {
    expect(decodeLineStream('{"line":"\\"')).toEqual({ status: "pending" });
  });
  it("streaming: quote-then-space does not open the card on whitespace", () => {
    // '{"line":"\" ' — opening wrap quote then a space, nothing real yet → pending
    expect(decodeLineStream('{"line":"\\" ')).toEqual({ status: "pending" });
  });
  it("streaming: strips the leading wrap quote as real chars arrive", () => {
    expect(decodeLineStream('{"line":"\\"can I'))
      .toEqual({ status: "streaming", text: "can I" });
  });
  it("streaming char-by-char never emits a leading quote", () => {
    const full = '{"line":"\\"can I share?\\""}';
    for (const s of driveCharByChar(full)) {
      if (s.status === "streaming") expect(s.text.startsWith('"')).toBe(false);
      if (s.status === "line") expect(s.line.startsWith('"')).toBe(false);
    }
    expect(decodeLineStream(full)).toEqual({ status: "line", line: "can I share?" });
  });
});
