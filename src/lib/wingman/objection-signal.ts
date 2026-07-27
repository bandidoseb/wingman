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

import { OBJECTION_SYSTEM_PROMPT, buildObjectionSystemPrompt, buildObjectionUserSegments, LEVER_TAXONOMY } from "./objection-prompt.mjs";
import { parseSSEBuffer } from "./sse-parse";
import { decodeLineStream, decodeLeverStream, stripWrappingQuotes } from "./json-line-stream";

const OBJECTION_MODEL = "claude-sonnet-4-6";
// The line is ~25 words (~40 tokens) + JSON wrapper. 150 is comfortable headroom that
// always lets the JSON close, while capping the tail if Sonnet starts appending prose.
const OBJECTION_MAX_TOKENS = 150;

// The system prompt is the SINGLE SOURCE OF TRUTH in ./objection-prompt.mjs — imported
// above for production and by scripts/objection-prompts.mjs for the eval gate, so the
// test always grades exactly what ships. Re-exported here for any external consumer.
export { OBJECTION_SYSTEM_PROMPT };

/**
 * Objection Flow thread state (Phase A accepts it; Phase B populates it live).
 * When present with beatNumber > 1, the card is a CONTINUATION — the generator feeds the
 * verbatim moves already given + the exchange since the objection opened, so Sonnet advances
 * the sequence instead of restarting. Absent → single-shot (byte-identical to pre-threading).
 */
export type ObjectionThread = {
  linesGiven: string[];        // verbatim lines already handed to the rep (the no-repeat guard)
  historyTranscript: string;   // anchored transcript, recap-cursor → last-move cursor (append-only between synth ticks)
  beatNumber: number;          // 1 = first card (single-shot); 2+ = a continuation beat
  gapFlag?: boolean;           // >~40s since last press → tell Sonnet to re-evaluate same-vs-new
  flowRecap?: string;          // Step 2: rolling strategic recap of the exchange's absorbed middle
  leversUsed?: string[];       // B4: plays run this flow, in order (flow-scoped — never from archive)
};

/**
 * Call-level objection memory (Step 2): archived learnings from EARLIER flows this call.
 * Compact + cached + pre-computed — never a press-time latency tax. Applies to beat-1 too
 * (a resurfacing objection must not restart at square one).
 */
export type ObjectionCallMemory = {
  recaps: string[];            // archived flow recaps (capped last 3 × 700 chars)
  linesGiven: string[];        // every line given in earlier flows (capped last 8 × 200 chars)
};

type ContentBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

// The user-message shape MUST be identical for the streaming and non-streaming paths so the
// eval-validated behavior holds regardless of which one ships. Both call this; the segment
// SHAPE is the single source of truth in objection-prompt.mjs (shared with the eval).
// cache:true segments get a cache_control breakpoint — the frozen belief + append-only history
// prefill from cache on later beats; the small volatile tail (moves/beat/marker/latest) is fresh.
function buildUserContent(
  transcriptChunk: string,
  liveSummary?: string,
  thread?: ObjectionThread,
  callMemory?: ObjectionCallMemory,
  leverToAvoid?: string,
): ContentBlock[] {
  const segs = buildObjectionUserSegments({
    liveSummary,
    latestResponse: transcriptChunk,
    thread,
    flowRecap: thread?.flowRecap,
    callMemory,
    leverToAvoid,
  }) as Array<{ text: string; cache?: boolean }>;
  return segs.map((s) =>
    s.cache
      ? { type: "text", text: s.text, cache_control: { type: "ephemeral" } }
      : { type: "text", text: s.text },
  );
}

/**
 * Three outcomes the route must tell apart:
 *   - line    : a real spoken line to show on the objection card.
 *   - abstain : Sonnet judged nothing is standing → show the static "No objection
 *               detected" nudge. This is the honesty gate, now done by Sonnet itself
 *               (the Groq distiller that used to gate it was removed 2026-06-30).
 *   - error   : API / timeout / unparseable → the client shows the retry pill.
 */
export type ObjectionCardResult =
  | { status: "line"; line: string; lever?: string }  // lever: threaded beats only (B4)
  | { status: "abstain" }
  | { status: "error" };

/** Validated lever or undefined — unknown/missing levers degrade to "no guard", never error. */
function readLever(v: unknown): string | undefined {
  return typeof v === "string" && LEVER_TAXONOMY.includes(v) ? v : undefined;
}

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
    if (typeof v === "string") {
      const line = stripWrappingQuotes(v.trim());
      return line
        ? { status: "line", line, lever: readLever((p as { lever?: unknown }).lever) }
        : { status: "abstain" };
    }
    if (v === null) return { status: "abstain" };
    return null;
  };

  try { const r = fromObj(JSON.parse(cleaned)); if (r) return r; } catch { /* fall through */ }

  const block = cleaned.match(/\{[\s\S]*\}/);
  if (block) { try { const r = fromObj(JSON.parse(block[0])); if (r) return r; } catch { /* fall through */ } }

  const m = cleaned.match(/"line"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m) {
    const line = stripWrappingQuotes(m[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim());
    return line ? { status: "line", line } : { status: "abstain" };
  }
  if (/"line"\s*:\s*null/.test(cleaned)) return { status: "abstain" };

  return { status: "error" };
}

async function generateObjectionAttempt(
  transcriptChunk: string,
  liveSummary?: string,
  thread?: ObjectionThread,
  callMemory?: ObjectionCallMemory,
  leverToAvoid?: string,
  confrontation?: string,
): Promise<ObjectionCardResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[generateObjectionCard] ANTHROPIC_API_KEY not set");
    return { status: "error" };
  }

  const t0 = Date.now();

  // No objection is handed in (Groq removed) — Sonnet infers it from the transcript,
  // exactly as validated by the eval's production-faithful arm. `thread` (Phase B) turns this
  // into a continuation beat; absent → single-shot, byte-identical to before.
  const userContent = buildUserContent(transcriptChunk, liveSummary, thread, callMemory, leverToAvoid);

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
        system:     buildObjectionSystemPrompt(confrontation),
        messages:   [{ role: "user", content: userContent }],
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

/**
 * generateObjectionCard — non-streaming variant with the SAME B4 consecutive-lever guard as the
 * streaming wrapper (the eval's guard sim runs this path; parity is load-bearing — rev-7 §5).
 */
export async function generateObjectionCard(
  transcriptChunk: string,
  liveSummary?: string,
  thread?: ObjectionThread,
  callMemory?: ObjectionCallMemory,
  confrontation?: string,
): Promise<ObjectionCardResult> {
  const levers = (thread?.leversUsed ?? []).filter((v) => LEVER_TAXONOMY.includes(v));
  const lastLever = levers.length ? levers[levers.length - 1] : undefined;
  const guardActive = !!(thread && Number(thread.beatNumber) > 1 && lastLever && lastLever !== "direct-close");

  const first = await generateObjectionAttempt(transcriptChunk, liveSummary, thread, callMemory, undefined, confrontation);
  if (!guardActive || first.status !== "line" || !first.lever || first.lever !== lastLever) return first;

  console.log(`[generateObjectionCard] lever "${lastLever}" repeated back-to-back — retrying once`);
  const second = await generateObjectionAttempt(transcriptChunk, liveSummary, thread, callMemory, lastLever, confrontation);
  // Humility valve: ship attempt 2 whatever it is; fall back to attempt 1 only on hard error.
  return second.status === "error" ? first : second;
}

/**
 * Streaming variant — yields the spoken line as Sonnet writes it.
 *
 * The route turns these into SSE frames; the HUD reveals the text at a constant rate.
 * The decoder (json-line-stream.ts) opens the JSON envelope and surfaces ONLY the inner
 * line characters, fully resolved — so the `{"line":"` wrapper, escapes, and the closing
 * `"}` never reach the screen, and an abstain (`{"line":null}` / empty) emits ZERO deltas
 * (BLOCKER 2/3 in the 2026-06-30 plan review).
 *
 * Self-sufficient timeouts (W7): the client guard can't fire if the renderer died, so this
 * carries its own AbortController — TTFB ~8s (abort if no first text), total ~15s hard cap.
 * On any failure it yields exactly one terminal `{kind:"error"}` and returns.
 *
 * `signal` (optional): the route passes the request's AbortSignal so a client disconnect /
 * dismiss / call-end stops Sonnet generation immediately (W6 — don't bill an abandoned card).
 */
export type ObjectionStreamEvent =
  | { kind: "lever-info"; lever?: string } // B4 internal — consumed by the wrapper, NEVER reaches the route
  | { kind: "delta"; textSoFar: string }
  | { kind: "abstain" }
  | { kind: "done"; line: string; lever?: string }
  | { kind: "error" };

// Sonnet's cold first token (un-warmed connection) can run ~6s; give comfortable margin so
// a slow-but-alive cold start isn't aborted. Sits below the client's 14s TTFB so the server
// resolves first with a clean error frame instead of the client aborting the socket.
const OBJECTION_TTFB_MS  = 12_000;  // abort if no first text token by here
const OBJECTION_TOTAL_MS = 20_000;  // absolute ceiling on the whole stream

async function* streamObjectionAttempt(
  transcriptChunk: string,
  liveSummary?: string,
  signal?: AbortSignal,
  thread?: ObjectionThread,
  callMemory?: ObjectionCallMemory,
  leverToAvoid?: string,
  confrontation?: string,
): AsyncGenerator<ObjectionStreamEvent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[streamObjectionCard] ANTHROPIC_API_KEY not set");
    yield { kind: "error" };
    return;
  }

  const t0 = Date.now();
  const controller = new AbortController();
  // If the client/route aborts (disconnect, dismiss, call-end), tear down our fetch too.
  const onUpstreamAbort = () => controller.abort();
  signal?.addEventListener("abort", onUpstreamAbort, { once: true });

  const totalTimer = setTimeout(() => controller.abort(), OBJECTION_TOTAL_MS);
  let ttfbTimer: ReturnType<typeof setTimeout> | null = setTimeout(
    () => controller.abort(),
    OBJECTION_TTFB_MS,
  );
  const clearTtfb = () => { if (ttfbTimer) { clearTimeout(ttfbTimer); ttfbTimer = null; } };

  let emittedLen = 0;     // length of the longest delta text already yielded (monotonic)
  let sawFirstText = false;
  let leverReported = false; // B4: lever-info yielded once per attempt

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
        system:     buildObjectionSystemPrompt(confrontation),
        messages:   [{ role: "user", content: buildUserContent(transcriptChunk, liveSummary, thread, callMemory, leverToAvoid) }],
        stream:     true,
      }),
      signal: controller.signal,
    });

    if (!resp.ok || !resp.body) {
      console.error("[streamObjectionCard] Sonnet error:", resp.status, await resp.text().catch(() => ""));
      yield { kind: "error" };
      return;
    }

    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();
    let sseBuf    = "";   // raw Anthropic SSE text not yet framed
    let rawModel  = "";   // accumulated model output text (the JSON envelope)

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      sseBuf += decoder.decode(value, { stream: true });
      const { events, rest } = parseSSEBuffer(sseBuf);
      sseBuf = rest;

      for (const ev of events) {
        // Anthropic streams text in `content_block_delta` events; ignore the rest
        // (message_start/stop, ping, content_block_start/stop, message_delta).
        if (ev.event !== "content_block_delta") continue;
        let text: string | undefined;
        try { text = JSON.parse(ev.data)?.delta?.text; } catch { /* partial/ignorable */ }
        if (typeof text !== "string" || text.length === 0) continue;

        rawModel += text;

        // B4: report the lever the instant it resolves (or is definitively absent) — before any
        // line char is emitted, so the wrapper's guard decision happens pre-paint.
        if (!leverReported) {
          const ls = decodeLeverStream(rawModel);
          if (ls.status !== "pending") {
            leverReported = true;
            yield { kind: "lever-info", lever: ls.status === "lever" ? readLever(ls.lever) : undefined };
          }
        }

        const state = decodeLineStream(rawModel);

        if (state.status === "pending") continue;

        if (!sawFirstText) { sawFirstText = true; clearTtfb(); }

        if (state.status === "streaming") {
          if (state.text.length > emittedLen) {
            emittedLen = state.text.length;
            yield { kind: "delta", textSoFar: state.text };
          }
        } else if (state.status === "line") {
          const ms = Date.now() - t0;
          console.log(`[streamObjectionCard] ${ms}ms ✓ line`);
          const finalLever = decodeLeverStream(rawModel);
          yield { kind: "done", line: state.line, lever: finalLever.status === "lever" ? readLever(finalLever.lever) : undefined };
          return;
        } else if (state.status === "abstain") {
          console.log(`[streamObjectionCard] ${Date.now() - t0}ms ✓ abstain`);
          yield { kind: "abstain" };
          return;
        } else {
          // structural error in the envelope
          console.error("[streamObjectionCard] Unparseable envelope:", rawModel.slice(0, 200));
          yield { kind: "error" };
          return;
        }
      }
    }

    // Stream closed without an explicit terminal — resolve from what we have.
    const final = decodeLineStream(rawModel);
    if (final.status === "line") {
      const lv = decodeLeverStream(rawModel);
      yield { kind: "done", line: final.line, lever: lv.status === "lever" ? readLever(lv.lever) : undefined };
      return;
    }
    if (final.status === "abstain") { yield { kind: "abstain" }; return; }
    // truncated mid-line (max_tokens / early close) — never paint half a spoken line.
    console.error("[streamObjectionCard] Stream ended unresolved:", rawModel.slice(0, 200));
    yield { kind: "error" };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[streamObjectionCard] Aborted (timeout or client disconnect)");
    } else {
      console.error("[streamObjectionCard] Error:", err);
    }
    yield { kind: "error" };
  } finally {
    clearTtfb();
    clearTimeout(totalTimer);
    signal?.removeEventListener("abort", onUpstreamAbort);
    // Deterministically stop Sonnet if the consumer abandons this attempt early (B4 retry break,
    // or a route-side disconnect breaking the for-await). No-op after a normal completion.
    controller.abort();
  }
}

/**
 * streamObjectionCard — B4 wrapper: the consecutive-same-lever guard with an INVISIBLE retry.
 *
 * Attempt 1 streams normally UNLESS its declared lever (parsed pre-paint, before any line char)
 * equals the flow's LAST lever (and isn't "direct-close" — re-closing is doctrine). In that one
 * case the wrapper stops consuming attempt 1 (its finally aborts Sonnet at ~10 output tokens),
 * yields NOTHING to the route, and streams attempt 2 with the escalate-or-switch nudge. If
 * attempt 2 insists on the same lever, it ships (humility valve — may be a deliberate
 * escalation). Guard NEVER fires on abstain, on a missing/unknown lever (degrade to no-guard),
 * or on single-shot beats. One shared 20s budget spans both attempts.
 */
export async function* streamObjectionCard(
  transcriptChunk: string,
  liveSummary?: string,
  signal?: AbortSignal,
  thread?: ObjectionThread,
  callMemory?: ObjectionCallMemory,
  confrontation?: string,
): AsyncGenerator<ObjectionStreamEvent> {
  const levers = (thread?.leversUsed ?? []).filter((v) => LEVER_TAXONOMY.includes(v));
  const lastLever = levers.length ? levers[levers.length - 1] : undefined;
  const guardActive = !!(thread && Number(thread.beatNumber) > 1 && lastLever && lastLever !== "direct-close");

  // ONE budget across both attempts (rev-7 decision) — never a ~40s flagged beat.
  const outer = new AbortController();
  const onUpstream = () => outer.abort();
  signal?.addEventListener("abort", onUpstream, { once: true });
  const outerTimer = setTimeout(() => outer.abort(), OBJECTION_TOTAL_MS);

  try {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const leverToAvoid = attempt === 2 ? lastLever : undefined;
      let attemptLever: string | undefined;
      let retry = false;
      let decided = !guardActive || attempt === 2; // no guard → pure passthrough

      const inner = streamObjectionAttempt(transcriptChunk, liveSummary, outer.signal, thread, callMemory, leverToAvoid, confrontation);
      for await (const ev of inner) {
        if (ev.kind === "lever-info") { attemptLever = ev.lever; continue; } // internal — never forwarded
        if (!decided && (ev.kind === "delta" || ev.kind === "done")) {
          // Guard decision point — first line char about to paint, OR a short line that resolved
          // in one chunk (done with zero deltas — reviewer finding: still pre-paint, still
          // invisible to retry since nothing was forwarded). Abstain stays excluded (no guard).
          decided = true;
          if (attemptLever && attemptLever === lastLever) {
            retry = true;
            break; // stop consuming → inner's finally aborts Sonnet; yield NOTHING (invisible)
          }
        }
        yield ev; // abstain/error/delta/done all pass through untouched
        if (ev.kind === "done" || ev.kind === "abstain" || ev.kind === "error") return;
      }
      if (!retry) return; // inner ended without a terminal (it yields its own error in that case)
      console.log(`[streamObjectionCard] lever "${lastLever}" repeated back-to-back — invisible retry (attempt 2)`);
    }
  } finally {
    clearTimeout(outerTimer);
    signal?.removeEventListener("abort", onUpstream);
  }
}
