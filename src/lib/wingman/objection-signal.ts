/**
 * objection-signal.ts — live objection card via the validated Sonnet prompt.
 *
 * generateObjectionCard(transcriptChunk, liveSummary?):
 *   Generates the ONE line the rep says next to handle a live objection. NO KB,
 *   NO retrieval, NO Groq — the card is reasoned from the Belief Ladder summary + the
 *   last ~120s of transcript; Sonnet infers the objection itself AND decides whether one
 *   is even standing. Returns a discriminated result: { status:"line", line } (real card),
 *   { status:"abstain" } (nothing standing → the static "No objection detected" nudge), or
 *   { status:"error" } (API/timeout/parse failure → the client's retry pill). The Groq
 *   distiller that used to hand in the objection + gate the nudge was removed 2026-06-30
 *   (the eval showed the hint added nothing and Sonnet abstains reliably — 7/7, 0 false-silence).
 *
 * Model: Claude Sonnet 4.6 (tonality is the product here; Haiku had a stubborn tic).
 *
 * The prompt is the eval-validated MERGE (2026-06-28): v1's tonality body + an
 * accuracy fence (no fabrication, no invented social proof, confidence-gated
 * numbers, anchor-only-when-it-sharpens). Validated offline in scripts/objection-eval.mjs
 * (arm "P" = this prompt, no anchors): 0 fabrications across 6 runs, tonality ~4.9/5.
 * If you change this prompt, re-run that eval before shipping.
 *
 * Anchor-specific rules (confidence-gated numbers) are dormant-but-safe until the
 * summary carries confirmation signals (Phase 2) and structured anchors (Phase 3):
 * with no confirmation signal the "if unsure, don't say the digits" default holds.
 */

import { OBJECTION_SYSTEM_PROMPT } from "./objection-prompt.mjs";

const OBJECTION_MODEL = "claude-sonnet-4-6";
// The line is ~25 words (~40 tokens) + JSON wrapper. 150 is comfortable headroom that
// always lets the JSON close, while capping the tail if Sonnet starts appending prose.
const OBJECTION_MAX_TOKENS = 150;

// The system prompt is the SINGLE SOURCE OF TRUTH in ./objection-prompt.mjs — imported
// above for production and by scripts/objection-prompts.mjs for the eval gate, so the
// test always grades exactly what ships. Re-exported here for any external consumer.
export { OBJECTION_SYSTEM_PROMPT };

/**
 * Three outcomes the route must tell apart:
 *   - line    : a real spoken line to show on the objection card.
 *   - abstain : Sonnet judged nothing is standing → show the static "No objection
 *               detected" nudge. This is the honesty gate, now done by Sonnet itself
 *               (the Groq distiller that used to gate it was removed 2026-06-30).
 *   - error   : API / timeout / unparseable → the client shows the retry pill.
 */
export type ObjectionCardResult =
  | { status: "line"; line: string }
  | { status: "abstain" }
  | { status: "error" };

/**
 * Tolerant parse. The prompt returns ONE of:
 *   { "line": "<spoken words>" }  → a real line
 *   { "line": null }              → abstain ("no objection detected")
 * Sonnet occasionally appends prose after the JSON, so try strict JSON, then the first
 * {...} block, then regex — and crucially distinguish a DELIBERATE null (abstain) from
 * unparseable garbage (error), so an abstain never shows the retry pill and vice-versa.
 */
function parseObjection(raw: string): ObjectionCardResult {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  const fromObj = (p: unknown): ObjectionCardResult | null => {
    if (!p || typeof p !== "object" || !("line" in p)) return null;
    const v = (p as { line: unknown }).line;
    // An empty/whitespace string is "nothing to say" — treat it as an abstain, not a card.
    if (typeof v === "string") return v.trim() ? { status: "line", line: v.trim() } : { status: "abstain" };
    if (v === null) return { status: "abstain" };
    return null;
  };

  try { const r = fromObj(JSON.parse(cleaned)); if (r) return r; } catch { /* fall through */ }

  const block = cleaned.match(/\{[\s\S]*\}/);
  if (block) { try { const r = fromObj(JSON.parse(block[0])); if (r) return r; } catch { /* fall through */ } }

  const m = cleaned.match(/"line"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m) {
    const line = m[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim();
    return line ? { status: "line", line } : { status: "abstain" };
  }
  if (/"line"\s*:\s*null/.test(cleaned)) return { status: "abstain" };

  return { status: "error" };
}

export async function generateObjectionCard(
  transcriptChunk: string,
  liveSummary?: string,
): Promise<ObjectionCardResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[generateObjectionCard] ANTHROPIC_API_KEY not set");
    return { status: "error" };
  }

  const t0 = Date.now();

  // No objection is handed in (Groq removed) — Sonnet infers it from the transcript,
  // exactly as validated by the eval's production-faithful arm.
  const userMessage =
    `CALL MEMORY (what we already know about this prospect — lean on this):\n${liveSummary?.trim() || "(no call summary yet — this is early in the call)"}\n\n` +
    `WHAT WAS JUST SAID (last ~120s):\n${transcriptChunk}`;

  // 10s timeout — a Sonnet stall must not leave the client's isGeneratingRef stuck.
  // The client also has its own 12s guard + retry pill, so an error here is never dead air.
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 10_000);

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      OBJECTION_MODEL,
        max_tokens: OBJECTION_MAX_TOKENS,
        system:     OBJECTION_SYSTEM_PROMPT,
        messages:   [{ role: "user", content: userMessage }],
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      console.error("[generateObjectionCard] Sonnet error:", resp.status, await resp.text().catch(() => ""));
      return { status: "error" };
    }

    const data = await resp.json() as { content?: [{ text?: string }] };
    const raw  = data.content?.[0]?.text?.trim() ?? "";
    if (!raw) return { status: "error" };

    const result = parseObjection(raw);
    const ms = Date.now() - t0;
    if (result.status === "error") {
      console.error("[generateObjectionCard] Could not parse a line from:", raw.slice(0, 200));
    } else {
      console.log(`[generateObjectionCard] ${ms}ms ✓${result.status === "abstain" ? " (abstain — no objection standing)" : ""}`);
    }
    return result;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[generateObjectionCard] Timed out after 10s");
    } else {
      console.error("[generateObjectionCard] Error:", err);
    }
    return { status: "error" };
  } finally {
    clearTimeout(timeoutId);
  }
}
