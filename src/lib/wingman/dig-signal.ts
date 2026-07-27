/**
 * dig-signal.ts — live ↓ Dig Deeper card via the validated Sonnet dig prompt (4a.1 single-shot).
 *
 * streamDigCard(transcriptChunk, liveSummary?, signal?):
 *   Streams the ONE discovery question the rep asks next to build the weakest belief. NO KB,
 *   NO retrieval, NO Groq — reasoned from the Belief Ladder summary + the last ~120s of
 *   transcript. Sonnet declares the target belief FIRST (so the HUD can name it: "DIG · PAIN"),
 *   then the question. If the prospect is ready to close, Sonnet returns { "belief":null,
 *   "line":null } → a `nudge` terminal (Wingman tells the rep to take the close).
 *
 * Model: Claude Sonnet 4.6 (the question quality/tonality is the product — validated in
 * scripts/dig-eval.mjs: tonality 4.8/5 Claude + 5.0 gpt-4o, 100% right-belief, 0 fabrication).
 * If you change the prompt, re-run that eval before shipping.
 *
 * This is the SINGLE-SHOT generator. The chunk-down flow (DIG #N threading) is 4a.2 and wraps
 * this; the streaming shape here (belief-first envelope, decoder, timeouts) is the foundation.
 * Mirrors objection-signal.ts's streaming discipline (TTFB/total AbortControllers, req.signal
 * teardown, finally-aborts-Sonnet) minus threading/levers/callMemory/B4.
 */

import { DIG_SYSTEM_PROMPT, buildDigSystemPrompt, buildDigUserSegments, BELIEF_TAXONOMY } from "./dig-prompt.mjs";
import { parseSSEBuffer } from "./sse-parse";
import { decodeLineStream, decodeBeliefStream } from "./json-line-stream";

const DIG_MODEL = "claude-sonnet-4-6";
// The question is ~20 words (~30 tokens) + the {belief,line} JSON wrapper. 150 is comfortable
// headroom that always lets the JSON close while capping a runaway tail.
const DIG_MAX_TOKENS = 150;

// Re-exported for any external consumer; the single source of truth lives in dig-prompt.mjs.
export { DIG_SYSTEM_PROMPT };

type ContentBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

// salesDna: the rep's sanitized Sales DNA blob (Phase 1b offer-aware). The segment builder
// gates it internally — incomplete DNA injects nothing and the shape is byte-identical to
// the pre-1b prompt. When present, its segment carries the cache breakpoint that the
// warm-at-deploy prime (pipeline-warmup.ts) pre-loads.
function buildUserContent(
  transcriptChunk: string,
  liveSummary?: string,
  salesDna?: Record<string, string> | null,
): ContentBlock[] {
  return (buildDigUserSegments({ salesDna, liveSummary, latestResponse: transcriptChunk }) as Array<{ text: string; cache?: boolean }>).map(
    (s) => (s.cache ? { type: "text", text: s.text, cache_control: { type: "ephemeral" } } : { type: "text", text: s.text }),
  );
}

/** Validated belief id or undefined — unknown/missing degrades to no tag, never an error. */
function readBelief(v: unknown): string | undefined {
  return typeof v === "string" && BELIEF_TAXONOMY.includes(v) ? v : undefined;
}

/**
 * Streaming events the route turns into SSE frames:
 *   - belief : the target belief resolved (pre-paint) → HUD tag "DIG · <belief>".
 *   - delta  : the question text so far (decoder strips the JSON envelope).
 *   - nudge  : { "line":null } → take-the-close (Wingman tells the rep to close, not dig).
 *   - done   : authoritative final question (+ belief).
 *   - error  : API/timeout/unparseable → the client's retry pill.
 */
export type DigStreamEvent =
  | { kind: "belief"; belief?: string }
  | { kind: "delta"; textSoFar: string }
  | { kind: "nudge" }
  | { kind: "done"; line: string; belief?: string }
  | { kind: "error" };

// Cold first token (un-warmed connection) can run ~6s; TTFB sits below the client's 14s so the
// server resolves first with a clean error frame instead of the client aborting the socket.
const DIG_TTFB_MS  = 12_000;
const DIG_TOTAL_MS = 20_000;

export async function* streamDigCard(
  transcriptChunk: string,
  liveSummary?: string,
  signal?: AbortSignal,
  salesDna?: Record<string, string> | null,
  confrontation?: string,
): AsyncGenerator<DigStreamEvent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[streamDigCard] ANTHROPIC_API_KEY not set");
    yield { kind: "error" };
    return;
  }

  const t0 = Date.now();
  const controller = new AbortController();
  const onUpstreamAbort = () => controller.abort();
  signal?.addEventListener("abort", onUpstreamAbort, { once: true });

  const totalTimer = setTimeout(() => controller.abort(), DIG_TOTAL_MS);
  let ttfbTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => controller.abort(), DIG_TTFB_MS);
  const clearTtfb = () => { if (ttfbTimer) { clearTimeout(ttfbTimer); ttfbTimer = null; } };

  let emittedLen = 0;       // longest delta text already yielded (monotonic)
  let sawFirstText = false;
  let beliefReported = false;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      DIG_MODEL,
        max_tokens: DIG_MAX_TOKENS,
        system:     buildDigSystemPrompt(confrontation),
        messages:   [{ role: "user", content: buildUserContent(transcriptChunk, liveSummary, salesDna) }],
        stream:     true,
      }),
      signal: controller.signal,
    });

    if (!resp.ok || !resp.body) {
      console.error("[streamDigCard] Sonnet error:", resp.status, await resp.text().catch(() => ""));
      yield { kind: "error" };
      return;
    }

    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();
    let sseBuf    = "";   // raw Anthropic SSE not yet framed
    let rawModel  = "";   // accumulated model output (the JSON envelope)

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      sseBuf += decoder.decode(value, { stream: true });
      const { events, rest } = parseSSEBuffer(sseBuf);
      sseBuf = rest;

      for (const ev of events) {
        // Cache telemetry (Phase 1b): prove the DNA-prefix cache actually engages —
        // message_start carries usage. read>0 = warm hit (the prime / a prior press
        // paid for this prefix); creation>0 = this press wrote the cache; both 0 with
        // DNA present = the breakpoint is a silent no-op → investigate, don't assume.
        if (ev.event === "message_start") {
          try {
            const usage = JSON.parse(ev.data)?.message?.usage ?? {};
            console.log(
              `[streamDigCard] TIMING usage cache_read=${usage.cache_read_input_tokens ?? 0} ` +
              `cache_creation=${usage.cache_creation_input_tokens ?? 0} in=${usage.input_tokens ?? 0} ` +
              `dna=${salesDna ? "present" : "absent"}`,
            );
          } catch { /* telemetry only — never affects the stream */ }
          continue;
        }
        if (ev.event !== "content_block_delta") continue;
        let text: string | undefined;
        try { text = JSON.parse(ev.data)?.delta?.text; } catch { /* partial/ignorable */ }
        if (typeof text !== "string" || text.length === 0) continue;

        rawModel += text;

        // Report the target belief the instant it resolves (or is definitively absent),
        // before any question char paints, so the HUD tag opens as "DIG · <belief>".
        if (!beliefReported) {
          const bs = decodeBeliefStream(rawModel);
          if (bs.status !== "pending") {
            beliefReported = true;
            yield { kind: "belief", belief: bs.status === "lever" ? readBelief(bs.lever) : undefined };
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
          console.log(`[streamDigCard] ${Date.now() - t0}ms ✓ question`);
          const fb = decodeBeliefStream(rawModel);
          yield { kind: "done", line: state.line, belief: fb.status === "lever" ? readBelief(fb.lever) : undefined };
          return;
        } else if (state.status === "abstain") {
          // { "line":null } → the prospect is ready; take the close.
          console.log(`[streamDigCard] ${Date.now() - t0}ms ✓ take-the-close`);
          yield { kind: "nudge" };
          return;
        } else {
          console.error("[streamDigCard] Unparseable envelope:", rawModel.slice(0, 200));
          yield { kind: "error" };
          return;
        }
      }
    }

    // Stream closed without an explicit terminal — resolve from what we have.
    const final = decodeLineStream(rawModel);
    if (final.status === "line") {
      const fb = decodeBeliefStream(rawModel);
      yield { kind: "done", line: final.line, belief: fb.status === "lever" ? readBelief(fb.lever) : undefined };
      return;
    }
    if (final.status === "abstain") { yield { kind: "nudge" }; return; }
    console.error("[streamDigCard] Stream ended unresolved:", rawModel.slice(0, 200));
    yield { kind: "error" };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[streamDigCard] Aborted (timeout or client disconnect)");
    } else {
      console.error("[streamDigCard] Error:", err);
    }
    yield { kind: "error" };
  } finally {
    clearTtfb();
    clearTimeout(totalTimer);
    signal?.removeEventListener("abort", onUpstreamAbort);
    // Deterministically stop Sonnet if the consumer abandons early (route-side disconnect
    // breaking the for-await). No-op after a normal completion.
    controller.abort();
  }
}
