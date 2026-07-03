/**
 * live-tail.ts — #41 press-time partial-transcript merge (pure logic)
 *
 * The finalized transcript lags live speech by ~500ms median (measured p90
 * 1–2.8s, max 4.1s) because Deepgram only finalizes an utterance after it
 * closes. Reps press ↑ the INSTANT an objection ends, so the objection's
 * tail is often missing from every finals-derived buffer at press time —
 * the card generator then abstains ("no objection detected") or answers the
 * wrong thing.
 *
 * Deepgram's partial (interim) stream runs ~126ms behind speech and, at
 * press time, already contains ~68% of those missing words (measured,
 * 2026-07-03). This module holds the freshest partial per speaker and, at
 * press time, produces a marked "live tail" line to append to the outgoing
 * request — AFTER all capping, deduped against the finals tail actually
 * being sent.
 *
 * Invariants (plan rev 2 — tasks/todo.md):
 *  - Partials are EPHEMERAL: never written to any durable buffer, cursor,
 *    or DB save. This module's state is a tiny per-speaker map, swept on
 *    every update and reset per call.
 *  - `hotPartialAgeMs` returns +Infinity when no fresh partial exists —
 *    load-bearing: old packaged apps (no partial IPC) and quiet moments get
 *    ZERO settle wait and byte-identical requests.
 *  - Dedup is STRICT normalized substring — suppress only when the ENTIRE
 *    partial is already contained in the finals tail. Never fuzzy: dropping
 *    genuinely-new words silently defeats the feature (the worse failure).
 */

// Marker prefixing a live-tail line in the outgoing transcript. The prompt
// (objection-prompt.mjs) explains it; the eval asserts it never leaks into
// a generated line.
export const LIVE_TAIL_MARKER = "[live — still being transcribed]";

// A partial older than this no longer describes "right now" — it's a stale
// fragment of an utterance whose final either landed (and cleared it) or
// was lost. Excluded from the tail and swept from the map.
export const PARTIAL_FRESH_MS = 5000;

// A partial younger than this at press time means the speaker is likely
// mid-utterance — the caller waits SETTLE_WAIT_MS for the next partial to
// catch the last word(s) before generating.
export const HOT_PARTIAL_MS = 1500;
export const SETTLE_WAIT_MS = 350;

// Per-speaker cap on live-tail text (tail-kept) — bounds prompt cost to
// ~125 tokens even if a prospect monologues through a long partial.
export const LIVE_TAIL_MAX_CHARS = 500;

interface PartialEntry {
  text: string;
  at: number;
}

export interface LiveTailState {
  bySpeaker: Map<string, PartialEntry>;
}

export function createLiveTailState(): LiveTailState {
  return { bySpeaker: new Map() };
}

/** Parse a "Speaker: text" line into its parts. Returns null when malformed. */
function parseLine(line: string): { speaker: string; text: string } | null {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return null;
  const speaker = line.slice(0, colonIdx).trim();
  const text = line.slice(colonIdx + 1).trim();
  if (!speaker || !text) return null;
  return { speaker, text };
}

/** Lowercase, strip punctuation, collapse whitespace — the comparison space
 *  for the strict-substring dedup. Same normalization on both sides.
 *  Apostrophes are REMOVED (not spaced): Deepgram can render a contraction
 *  as "don't" in one pass and "dont" in another — both must normalize to
 *  "dont" or the dedup misses its own duplicate. */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sweep entries past freshness — keeps the map bounded even if speaker
 *  display names churn (Zoom renames) across a 2-hour call. */
function sweep(state: LiveTailState, now: number): void {
  for (const [speaker, entry] of state.bySpeaker) {
    if (now - entry.at > PARTIAL_FRESH_MS) state.bySpeaker.delete(speaker);
  }
}

/** Record the freshest partial for its speaker. Chunk format "Speaker: text". */
export function updatePartial(state: LiveTailState, chunk: string, now: number): void {
  sweep(state, now);
  for (const line of chunk.split("\n")) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    state.bySpeaker.set(parsed.speaker, { text: parsed.text, at: now });
  }
}

/**
 * A speaker's FINAL closes their in-progress interim segment — their partial
 * is consumed. A late out-of-order duplicate partial re-populating the map is
 * harmless: it fails the strict-substring dedup in getLiveTail (its text is
 * contained in the finals) and ages out within PARTIAL_FRESH_MS regardless.
 */
export function clearSpeakerFromFinal(state: LiveTailState, finalChunk: string): void {
  for (const line of finalChunk.split("\n")) {
    const parsed = parseLine(line);
    if (parsed) state.bySpeaker.delete(parsed.speaker);
  }
}

/**
 * Age in ms of the FRESHEST partial, or +Infinity when none exists within
 * PARTIAL_FRESH_MS. The +Infinity empty state is load-bearing: it is what
 * guarantees zero settle-wait (and byte-identical requests) on old packaged
 * apps without partial IPC and on presses after a genuine pause.
 */
export function hotPartialAgeMs(state: LiveTailState, now: number): number {
  let min = Number.POSITIVE_INFINITY;
  for (const entry of state.bySpeaker.values()) {
    const age = now - entry.at;
    if (age <= PARTIAL_FRESH_MS && age < min) min = age;
  }
  return min;
}

/**
 * Build the live-tail block to append AFTER the (already capped) finals tail
 * of the outgoing request. Empty string when there is nothing fresh to add.
 *
 * `finalsTail` must be the EXACT finals text being sent in this request
 * (threaded: the anchored latestResponse; beat-1: the 120s rolling window) —
 * deduping against anything else re-introduces duplication or false drops.
 */
export function getLiveTail(state: LiveTailState, finalsTail: string, now: number): string {
  const normFinals = normalizeForMatch(finalsTail);
  const lines: string[] = [];
  for (const [speaker, entry] of state.bySpeaker) {
    if (now - entry.at > PARTIAL_FRESH_MS) continue;
    const capped =
      entry.text.length > LIVE_TAIL_MAX_CHARS ? entry.text.slice(-LIVE_TAIL_MAX_CHARS) : entry.text;
    const norm = normalizeForMatch(capped);
    if (!norm) continue;
    // Strict substring: suppress ONLY when every word of the partial is
    // already in the finals tail (stale/duplicate partial). Partial overlap
    // still emits — duplicated words are a mild tonality risk; dropped new
    // words defeat the feature.
    if (normFinals.includes(norm)) continue;
    lines.push(`${speaker} ${LIVE_TAIL_MARKER}: ${capped}`);
  }
  return lines.join("\n");
}
