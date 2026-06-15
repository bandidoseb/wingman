/**
 * kb-memory-core.ts — PURE math + types for the in-memory KB search.
 *
 * Deliberately has ZERO runtime imports (no Supabase, no next/headers) so it is
 * unit-testable under vitest without path-alias or Next.js runtime setup, and so
 * the I/O shell (kb-memory.ts) and the offline parity script can both reuse the
 * exact same search semantics. See kb-memory.ts for the why/scale/lifecycle.
 */

export const DIM = 1536; // text-embedding-3-small dimensions

/** One immutable, normalized in-memory snapshot of the eligible KB. */
export interface KbSnapshot {
  /** count × DIM, each row L2-normalized so cosine similarity = dot product. */
  vectors:       Float32Array;
  /** number of valid trigger rows (≤ vectors.length / DIM). */
  count:         number;
  // Parallel metadata arrays — index r corresponds to vector row r.
  entryId:       string[];
  triggerText:   string[];
  techniqueName: string[];
  situation:     string[];
  exactScript:   string[];
  whyItWorks:    string[];
  callStage:     string[];
  qualityScore:  string[];
}

/** Shape returned to knowledge-search.ts — identical to its RPC `KBMatch`. */
export interface InMemoryMatch {
  id:              string;
  technique_name:  string;
  situation:       string;
  exact_script:    string;
  why_it_works:    string;
  call_stage:      string;
  quality_score:   string;
  similarity:      number;
  matched_trigger: string;
}

/** A parsed trigger row before packing — used by the loader and by tests. */
export interface RawTriggerRow {
  entry_id:       string;
  trigger_text:   string;
  embedding:      number[];
  technique_name: string;
  situation:      string;
  exact_script:   string;
  why_it_works:   string;
  call_stage:     string;
  quality_score:  string;
}

/** Parse a pgvector value (JSON-text `"[...]"` or already an array) → number[]. */
export function parseEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value)) return value as number[];
  if (typeof value === "string") {
    try {
      const arr = JSON.parse(value);
      return Array.isArray(arr) ? (arr as number[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Normalize an embedding into a fresh Float32Array of length DIM.
 * Returns null if the input is the wrong length or has zero magnitude.
 */
export function normalizeVector(vec: number[]): Float32Array | null {
  if (vec.length !== DIM) return null;
  let norm = 0;
  for (let i = 0; i < DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (!(norm > 0)) return null;
  const out = new Float32Array(DIM);
  for (let i = 0; i < DIM; i++) out[i] = vec[i] / norm;
  return out;
}

/**
 * Pack parsed rows into an immutable normalized snapshot. Rows with a malformed
 * or zero-magnitude embedding are skipped (never silently corrupt the array).
 */
export function packSnapshot(rows: RawTriggerRow[]): KbSnapshot {
  const n = rows.length;
  const vectors       = new Float32Array(n * DIM);
  const entryId:       string[] = new Array(n);
  const triggerText:   string[] = new Array(n);
  const techniqueName: string[] = new Array(n);
  const situation:     string[] = new Array(n);
  const exactScript:   string[] = new Array(n);
  const whyItWorks:    string[] = new Array(n);
  const callStage:     string[] = new Array(n);
  const qualityScore:  string[] = new Array(n);

  let w = 0; // valid-row write cursor (≤ n)
  for (const row of rows) {
    const unit = normalizeVector(row.embedding);
    if (!unit) continue;
    vectors.set(unit, w * DIM);
    entryId[w]       = row.entry_id;
    triggerText[w]   = row.trigger_text   ?? "";
    techniqueName[w] = row.technique_name ?? "";
    situation[w]     = row.situation      ?? "";
    exactScript[w]   = row.exact_script   ?? "";
    whyItWorks[w]    = row.why_it_works   ?? "";
    callStage[w]     = row.call_stage     ?? "";
    qualityScore[w]  = row.quality_score  ?? "";
    w++;
  }

  return {
    // subarray = a view over the same buffer, no copy; rows [w, n) are never read
    vectors:       w === n ? vectors : vectors.subarray(0, w * DIM),
    count:         w,
    entryId:       entryId.slice(0, w),
    triggerText:   triggerText.slice(0, w),
    techniqueName: techniqueName.slice(0, w),
    situation:     situation.slice(0, w),
    exactScript:   exactScript.slice(0, w),
    whyItWorks:    whyItWorks.slice(0, w),
    callStage:     callStage.slice(0, w),
    qualityScore:  qualityScore.slice(0, w),
  };
}

/**
 * Exact brute-force search over a snapshot. Pure — no global state.
 *
 * Mirrors the RPC's semantics: best trigger per entry (highest similarity),
 * then top `matchCount` entries by that similarity, filtered to ≥ `threshold`.
 *
 * Deterministic tiebreaks (so results never flap run-to-run):
 *  - within an entry: on equal similarity, the lower row index wins (rows are
 *    packed in ascending UUID order, so this is the lowest trigger id);
 *  - across entries: on equal similarity, the lower entry UUID wins.
 *
 * NOTE: the offline parity script (scripts/test-kb-memory-parity.mjs) mirrors
 * this exact algorithm in plain JS — keep them in sync if you change it.
 */
export function searchSnapshot(
  snap: KbSnapshot,
  queryEmbedding: number[],
  threshold: number,
  matchCount: number,
): InMemoryMatch[] {
  if (snap.count === 0) return [];
  const q = normalizeVector(queryEmbedding);
  if (!q) return [];

  const { vectors, count, entryId } = snap;

  // Best trigger row index per entry id.
  const bestRowByEntry = new Map<string, number>();
  const bestSimByEntry = new Map<string, number>();

  for (let r = 0; r < count; r++) {
    const base = r * DIM;
    let dot = 0;
    for (let i = 0; i < DIM; i++) dot += vectors[base + i] * q[i];

    const eid  = entryId[r];
    const prev = bestSimByEntry.get(eid);
    // strict `>` keeps the FIRST (lowest-index → lowest-id) trigger on ties
    if (prev === undefined || dot > prev) {
      bestSimByEntry.set(eid, dot);
      bestRowByEntry.set(eid, r);
    }
  }

  const candidates: { eid: string; sim: number; row: number }[] = [];
  for (const [eid, sim] of bestSimByEntry) {
    if (sim >= threshold) candidates.push({ eid, sim, row: bestRowByEntry.get(eid)! });
  }

  candidates.sort((a, b) =>
    b.sim - a.sim || (a.eid < b.eid ? -1 : a.eid > b.eid ? 1 : 0),
  );

  return candidates.slice(0, matchCount).map(({ sim, row }) => ({
    id:              snap.entryId[row],
    technique_name:  snap.techniqueName[row],
    situation:       snap.situation[row],
    exact_script:    snap.exactScript[row],
    why_it_works:    snap.whyItWorks[row],
    call_stage:      snap.callStage[row],
    quality_score:   snap.qualityScore[row],
    similarity:      sim,
    matched_trigger: snap.triggerText[row],
  }));
}
