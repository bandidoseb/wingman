/**
 * json-line-stream.ts — incremental decoder for the objection card's streaming JSON.
 *
 * Sonnet streams the card as a JSON envelope, ONE of:
 *   {"line":"<the spoken words>"}   → a real line
 *   {"line":null}                   → abstain ("No objection detected")
 *   {"line":""} / {"line":"   "}    → abstain (nothing to say)
 *
 * The model's stream deltas split at ARBITRARY byte boundaries — mid-escape (`\` in one
 * delta, `"` in the next), mid-`\uXXXX`, after the colon but before the value. So we never
 * reason about a single delta fragment. The caller accumulates ALL raw text and calls
 * `decodeLineStream(rawSoFar)` with the whole buffer each time; the function is PURE and
 * idempotent, re-deriving the fully-resolved decoded prefix from scratch. A character is
 * only ever surfaced once it is completely resolved — a dangling `\` or a partial `\u12`
 * is held back, never emitted, so the reveal never paints a half-escape.
 *
 * Contract (see BLOCKER 2/3 in the 2026-06-30 plan review):
 *   - "pending"   : not enough bytes yet to know line-vs-null, OR inside the string but no
 *                   non-whitespace character resolved yet. The caller must NOT open the card.
 *   - "streaming" : inside the string, `text` = decoded prefix (leading whitespace stripped,
 *                   monotonic — only grows). The card opens on the first "streaming" report.
 *   - "line"      : closing quote seen, `line` = decoded string, trimmed.
 *   - "abstain"   : null, or a string that closed empty/whitespace-only.
 *   - "error"     : the value is structurally not our contract (not a string, not null).
 */

export type DecodeState =
  | { status: "pending" }
  | { status: "streaming"; text: string }
  | { status: "line"; line: string }
  | { status: "abstain" }
  | { status: "error" };

// Single-char JSON escapes. `u` is handled separately (4 hex digits).
const ESCAPES: Record<string, string> = {
  '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t",
};

/**
 * Decode the JSON-string value of "line" out of the accumulated raw model output.
 * Pure: depends only on `raw`. Re-run on every growth of `raw`.
 */
export function decodeLineStream(raw: string): DecodeState {
  // Locate the `"line"` key, then the `:`, then skip whitespace to the value's first char.
  const keyIdx = raw.indexOf('"line"');
  if (keyIdx === -1) return { status: "pending" };

  let i = keyIdx + 6; // past `"line"`
  // skip whitespace up to and including the colon
  while (i < raw.length && /\s/.test(raw[i])) i++;
  if (i >= raw.length) return { status: "pending" };
  if (raw[i] !== ":") return { status: "error" };
  i++; // past `:`
  while (i < raw.length && /\s/.test(raw[i])) i++;
  if (i >= raw.length) return { status: "pending" };

  const first = raw[i];

  // ── null → abstain (tolerate it arriving char by char) ──────────────────
  if (first === "n") {
    const tail = raw.slice(i);
    if (tail.startsWith("null")) return { status: "abstain" };   // complete (maybe + trailing })
    if ("null".startsWith(tail)) return { status: "pending" };   // n / nu / nul still arriving
    return { status: "error" };                                  // e.g. "nope" — not our contract
  }

  // ── string value ────────────────────────────────────────────────────────
  if (first !== '"') return { status: "error" }; // numbers/booleans/arrays aren't our contract

  let out = "";
  let j = i + 1; // first char inside the string
  while (j < raw.length) {
    const c = raw[j];

    if (c === "\\") {
      // Need at least one char after the backslash to resolve the escape.
      if (j + 1 >= raw.length) break; // hold — escape incomplete
      const e = raw[j + 1];
      if (e === "u") {
        // \uXXXX — need 4 hex digits.
        if (j + 6 > raw.length) break; // hold — not all 4 digits arrived
        const hex = raw.slice(j + 2, j + 6);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) return { status: "error" };
        out += String.fromCharCode(parseInt(hex, 16));
        j += 6;
        continue;
      }
      if (e in ESCAPES) {
        out += ESCAPES[e];
        j += 2;
        continue;
      }
      return { status: "error" }; // invalid escape
    }

    if (c === '"') {
      // Unescaped closing quote → string complete.
      const line = out.trim();
      return line ? { status: "line", line } : { status: "abstain" };
    }

    out += c;
    j++;
  }

  // Reached the end of `raw` without a closing quote → still streaming.
  // Strip leading whitespace so a string that's only whitespace-so-far stays "pending"
  // (don't open the card on invisible content). Don't strip the tail — we don't know it yet.
  const partial = out.replace(/^\s+/, "");
  return partial ? { status: "streaming", text: partial } : { status: "pending" };
}

/**
 * decodeLeverStream — B4 sibling decoder for the optional leading `"lever"` field of the
 * THREADED envelope `{"lever":"<id>","line":"..."}`. Pure and idempotent like decodeLineStream
 * (which is UNTOUCHED — it locates the line via its own key search and is transparent to a
 * preceding field). Contract:
 *   - "pending" : the lever key/value hasn't fully arrived AND the line hasn't started either.
 *   - "lever"   : the lever string value closed → `lever` (verbatim; caller validates taxonomy).
 *   - "none"    : there is definitively NO lever — `"line"` was reached without a preceding
 *                 lever, or the lever value is null/non-string. This is the guard's
 *                 "degrade to no-guard" signal — deterministic at first-line-char (rev-7 §3/4).
 */
export type LeverDecodeState =
  | { status: "pending" }
  | { status: "lever"; lever: string }
  | { status: "none" };

export function decodeLeverStream(raw: string): LeverDecodeState {
  const keyIdx = raw.indexOf('"lever"');
  if (keyIdx === -1) {
    // No lever key (yet). If the line already resolved/started, the lever is definitively
    // absent (it was instructed to come FIRST) → none. Otherwise still pending.
    return decodeLineStream(raw).status === "pending" ? { status: "pending" } : { status: "none" };
  }

  let i = keyIdx + 7; // past `"lever"`
  while (i < raw.length && /\s/.test(raw[i])) i++;
  if (i >= raw.length) return { status: "pending" };
  if (raw[i] !== ":") return { status: "none" }; // malformed → no guard, never an error
  i++;
  while (i < raw.length && /\s/.test(raw[i])) i++;
  if (i >= raw.length) return { status: "pending" };

  const first = raw[i];
  if (first === "n") {
    const tail = raw.slice(i);
    if (tail.startsWith("null")) return { status: "none" };       // {"lever":null,...} → no guard
    if ("null".startsWith(tail)) return { status: "pending" };
    return { status: "none" };
  }
  if (first !== '"') return { status: "none" }; // non-string value → no guard

  // Lever ids are plain hyphen-words (taxonomy invariant) — no escapes expected; treat any
  // backslash as malformed → none (the guard degrades, the line decoder is unaffected).
  let out = "";
  let j = i + 1;
  while (j < raw.length) {
    const c = raw[j];
    if (c === "\\") return { status: "none" };
    if (c === '"') return { status: "lever", lever: out.trim() };
    out += c;
    j++;
  }
  return { status: "pending" }; // value still arriving
}
