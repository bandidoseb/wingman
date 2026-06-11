/**
 * Unit tests — parseDistillResponse (Phase 3.5 query distiller).
 *
 * The parser is the trust boundary between Groq's output and the route's
 * branching. Contract:
 *   {"objection": "<text>"} → { found: true, phrase }
 *   {"objection": null}     → { found: false }   (quality gate → nudge)
 *   anything malformed      → null               (degrade to raw path)
 */
import { describe, it, expect } from "vitest";
import { parseDistillResponse } from "../../src/lib/wingman/query-distill";

describe("parseDistillResponse", () => {
  it("parses a real objection", () => {
    expect(parseDistillResponse('{"objection": "I need to talk to my husband first"}'))
      .toEqual({ found: true, phrase: "I need to talk to my husband first" });
  });

  it("parses the no-objection gate (null)", () => {
    expect(parseDistillResponse('{"objection": null}')).toEqual({ found: false });
  });

  it("strips markdown code fences", () => {
    expect(parseDistillResponse('```json\n{"objection": "this is too expensive"}\n```'))
      .toEqual({ found: true, phrase: "this is too expensive" });
  });

  it("trims surrounding whitespace in the phrase", () => {
    expect(parseDistillResponse('{"objection": "  I got burned before  "}'))
      .toEqual({ found: true, phrase: "I got burned before" });
  });

  it("caps a runaway phrase at 160 chars (embedding budget)", () => {
    const long = "x".repeat(500);
    const result = parseDistillResponse(`{"objection": "${long}"}`);
    expect(result).not.toBeNull();
    if (result && result.found) {
      expect(result.phrase.length).toBe(160);
    } else {
      throw new Error("expected found:true");
    }
  });

  it("returns null (degrade) on truncated JSON", () => {
    expect(parseDistillResponse('{"objection": "I am scared I will'))
      .toBeNull();
  });

  it("returns null (degrade) on prose instead of JSON", () => {
    expect(parseDistillResponse("The prospect objects to the price."))
      .toBeNull();
  });

  it("returns null (degrade) when the objection key is missing", () => {
    expect(parseDistillResponse('{"answer": "wrong shape"}')).toBeNull();
  });

  it("returns null (degrade) on an empty-string objection", () => {
    expect(parseDistillResponse('{"objection": ""}')).toBeNull();
    expect(parseDistillResponse('{"objection": "   "}')).toBeNull();
  });

  it("returns null (degrade) on a non-string, non-null objection", () => {
    expect(parseDistillResponse('{"objection": 42}')).toBeNull();
    expect(parseDistillResponse('{"objection": ["a"]}')).toBeNull();
  });

  it("returns null (degrade) on a bare JSON null or array", () => {
    expect(parseDistillResponse("null")).toBeNull();
    expect(parseDistillResponse('["objection"]')).toBeNull();
  });
});
