/**
 * Unit tests — kb-memory-core (in-memory KB search math).
 *
 * Covers the trust-critical pure logic that replaces the Supabase RPC on the
 * live press path: embedding parse, normalization, snapshot packing (incl.
 * skipping malformed rows), and the search semantics that must mirror the RPC —
 * best-trigger-per-entry dedupe, threshold filter, top-N, and DETERMINISTIC
 * tiebreaks (so results never flap and parity with the RPC holds).
 */
import { describe, it, expect } from "vitest";
import {
  DIM,
  parseEmbedding,
  normalizeVector,
  packSnapshot,
  searchSnapshot,
  type RawTriggerRow,
} from "../../src/lib/wingman/kb-memory-core";

// ── helpers ───────────────────────────────────────────────────────────────────
/** Sparse vector of length DIM with `scale` at index k (else 0). */
function basis(k: number, scale = 1): number[] {
  const v = new Array(DIM).fill(0);
  v[k] = scale;
  return v;
}
/** Two-hot vector: `a` at i, `b` at j. */
function twoHot(i: number, a: number, j: number, b: number): number[] {
  const v = new Array(DIM).fill(0);
  v[i] = a;
  v[j] = b;
  return v;
}
function mkRow(entry_id: string, embedding: number[], extra: Partial<RawTriggerRow> = {}): RawTriggerRow {
  return {
    entry_id,
    trigger_text:   extra.trigger_text   ?? `trig-${entry_id}`,
    embedding,
    technique_name: extra.technique_name ?? `tech-${entry_id}`,
    situation:      extra.situation      ?? "",
    exact_script:   extra.exact_script   ?? "",
    why_it_works:   extra.why_it_works   ?? "",
    call_stage:     extra.call_stage     ?? "",
    quality_score:  extra.quality_score  ?? "high",
  };
}

describe("parseEmbedding", () => {
  it("passes through a number array", () => {
    expect(parseEmbedding([0.1, 0.2, 0.3])).toEqual([0.1, 0.2, 0.3]);
  });
  it("parses a pgvector JSON-text string", () => {
    expect(parseEmbedding("[0.1,0.2,0.3]")).toEqual([0.1, 0.2, 0.3]);
  });
  it("returns null for a non-JSON string", () => {
    expect(parseEmbedding("not a vector")).toBeNull();
  });
  it("returns null for a JSON string that isn't an array", () => {
    expect(parseEmbedding('{"x":1}')).toBeNull();
  });
  it("returns null for unsupported types", () => {
    expect(parseEmbedding(42)).toBeNull();
    expect(parseEmbedding(null)).toBeNull();
    expect(parseEmbedding(undefined)).toBeNull();
  });
});

describe("normalizeVector", () => {
  it("returns null for the wrong length", () => {
    expect(normalizeVector([1, 2, 3])).toBeNull();
  });
  it("returns null for a zero-magnitude vector", () => {
    expect(normalizeVector(new Array(DIM).fill(0))).toBeNull();
  });
  it("produces a unit vector", () => {
    const out = normalizeVector(twoHot(0, 3, 1, 4))!; // |(3,4)| = 5
    expect(out).not.toBeNull();
    let sumSq = 0;
    for (let i = 0; i < DIM; i++) sumSq += out[i] * out[i];
    expect(sumSq).toBeCloseTo(1, 6);
    expect(out[0]).toBeCloseTo(0.6, 6);
    expect(out[1]).toBeCloseTo(0.8, 6);
  });
});

describe("packSnapshot", () => {
  it("packs valid rows and preserves count", () => {
    const snap = packSnapshot([mkRow("a", basis(0)), mkRow("b", basis(1))]);
    expect(snap.count).toBe(2);
    expect(snap.entryId).toEqual(["a", "b"]);
    expect(snap.vectors.length).toBe(2 * DIM);
  });

  it("skips rows with a malformed (wrong-length) embedding without corrupting alignment", () => {
    const snap = packSnapshot([
      mkRow("a", basis(0)),
      mkRow("bad", [1, 2, 3]),       // wrong length → skipped
      mkRow("c", basis(2)),
    ]);
    expect(snap.count).toBe(2);
    expect(snap.entryId).toEqual(["a", "c"]); // "bad" dropped, alignment intact
  });

  it("skips zero-magnitude rows", () => {
    const snap = packSnapshot([mkRow("z", new Array(DIM).fill(0)), mkRow("a", basis(0))]);
    expect(snap.count).toBe(1);
    expect(snap.entryId).toEqual(["a"]);
  });

  it("normalizes stored vectors (an unnormalized input still matches at 1.0)", () => {
    const snap = packSnapshot([mkRow("a", basis(0, 9))]); // magnitude 9
    const [hit] = searchSnapshot(snap, basis(0), 0.5, 5);
    expect(hit.similarity).toBeCloseTo(1, 6);
  });
});

describe("searchSnapshot", () => {
  it("returns [] for an empty snapshot", () => {
    expect(searchSnapshot(packSnapshot([]), basis(0), 0.5, 5)).toEqual([]);
  });

  it("returns [] for a malformed query (wrong length)", () => {
    const snap = packSnapshot([mkRow("a", basis(0))]);
    expect(searchSnapshot(snap, [1, 2, 3], 0.0, 5)).toEqual([]);
  });

  it("finds the exact match as top-1", () => {
    const snap = packSnapshot([mkRow("a", basis(0)), mkRow("b", basis(1)), mkRow("c", basis(2))]);
    const res = searchSnapshot(snap, basis(1), 0.5, 5);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("b");
    expect(res[0].similarity).toBeCloseTo(1, 6);
  });

  it("dedupes to the BEST trigger per entry", () => {
    // entry "a" has two triggers: basis(0) and basis(5). Query basis(5) → the
    // basis(5) trigger wins; "a" appears once.
    const snap = packSnapshot([
      mkRow("a", basis(0), { trigger_text: "weak" }),
      mkRow("a", basis(5), { trigger_text: "strong" }),
    ]);
    const res = searchSnapshot(snap, basis(5), 0.5, 5);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("a");
    expect(res[0].matched_trigger).toBe("strong");
    expect(res[0].similarity).toBeCloseTo(1, 6);
  });

  it("filters out matches below the threshold", () => {
    // query 45° between basis(0) and basis(1): similarity to basis(0) ≈ 0.707
    const snap = packSnapshot([mkRow("a", basis(0))]);
    expect(searchSnapshot(snap, twoHot(0, 1, 1, 1), 0.8, 5)).toEqual([]); // 0.707 < 0.8
    const res = searchSnapshot(snap, twoHot(0, 1, 1, 1), 0.5, 5);          // 0.707 ≥ 0.5
    expect(res).toHaveLength(1);
    expect(res[0].similarity).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it("respects matchCount", () => {
    const snap = packSnapshot([mkRow("a", basis(0)), mkRow("b", basis(1)), mkRow("c", basis(2))]);
    // a query equally close to all three (each component aligned) — but use a
    // query that hits all at the same sim so matchCount is the only limiter:
    const q = new Array(DIM).fill(0);
    q[0] = 1; q[1] = 1; q[2] = 1; // equal sim to basis(0/1/2)
    const res = searchSnapshot(snap, q, 0.0, 2);
    expect(res).toHaveLength(2);
  });

  it("breaks cross-entry ties deterministically by lower entry id", () => {
    // "b" and "a" both match basis(7) at sim 1.0 — "a" must come first.
    const snap = packSnapshot([mkRow("b", basis(7)), mkRow("a", basis(7))]);
    const res = searchSnapshot(snap, basis(7), 0.5, 5);
    expect(res.map((r) => r.id)).toEqual(["a", "b"]);
    expect(res[0].similarity).toBeCloseTo(1, 6);
    expect(res[1].similarity).toBeCloseTo(1, 6);
  });

  it("normalizes the query (an unnormalized query matches identically)", () => {
    const snap = packSnapshot([mkRow("a", basis(0))]);
    const res = searchSnapshot(snap, basis(0, 12), 0.5, 5); // magnitude 12
    expect(res).toHaveLength(1);
    expect(res[0].similarity).toBeCloseTo(1, 6);
  });
});
