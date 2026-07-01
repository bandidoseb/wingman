/**
 * pipeline-warmup.ts — Phase 3.5 (#38) connection warm-up.
 *
 * WHY: the first request to each external service pays one-time setup — DNS,
 * TLS handshake, connection-pool open. Live samples showed that cold cost
 * dominating press-to-card latency (embedding 1.5–1.7s cold vs ~0.2s warm).
 * Firing tiny throwaway requests at CALL START moves that cost to a moment
 * nobody is waiting, so the rep's FIRST hotkey press behaves like a warm one.
 *
 * As of the in-memory KB work, vector search no longer hits Supabase on the hot
 * path (see kb-memory.ts), so there is no index to "wake" here — instead we kick
 * the in-memory KB load so it's `ready` before the first press.
 *
 * Warm goal: 1.5–2s press-to-card (Sebastian, 2026-06-11). Measured by the
 * [kb-signal] TIMING line; idleGap= in that line is the connection-COOLING
 * probe (long quiet stretches may re-cool — measure before building any
 * periodic keep-warm; see tasks/todo.md).
 *
 * GUARANTEES (plan review MAJOR 5):
 * - Never throws: three independent pings via Promise.allSettled, each with
 *   its own timeout and its own catch. Call sites still `void ...catch()`.
 * - Never awaited on the request path — call start latency is unaffected.
 * - Bounded cost: ~1 embed token + 1 Haiku token + 1 Groq token + one RPC
 *   per call start (<$0.001). A session-create retry warms twice — accepted.
 *
 * NOTE: prompt caching (cache_control) was evaluated and EXCLUDED here — the
 * kb-signal system prompt (~430 tokens) is below Haiku's 2,048-token minimum
 * cacheable block, so it cannot engage. Connection warm-up + the short
 * distilled query are the load-bearing latency levers.
 *
 * Railway runs a persistent Node server, so this work completes after the
 * HTTP response is sent (same proven pattern as the post-call job kickoff).
 * On serverless (Vercel) background work is killed at response end — revisit
 * if hosting ever moves.
 */

import { ensureKbMemoryLoaded, getKbMemoryState } from "./kb-memory";

const PING_TIMEOUT_MS = 4_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Kick the in-memory KB load + warm the OpenAI embed connection.
 *
 * Search is now in-process (kb-memory.ts), so there is no RPC to "wake" here —
 * the win is (a) starting the memory load if it isn't already running, and (b)
 * warming the OpenAI TLS/pool, since embedding the prospect's phrase is still on
 * the hot path (~200–500ms when warm). We report the KB state so the [warmup]
 * log line shows whether memory was already ready at call start.
 */
async function warmEmbedAndKb(): Promise<string> {
  // Idempotent: instrumentation.ts kicks this at boot; this covers a load that
  // errored, or a server that booted before this code existed. Non-blocking.
  ensureKbMemoryLoaded();

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return `embed:skipped(no-key) kb:${getKbMemoryState()}`;

  const resp = await fetchWithTimeout("https://api.openai.com/v1/embeddings", {
    method:  "POST",
    headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ model: "text-embedding-3-small", input: "warm" }),
  });
  return `${resp.ok ? "embed:ok" : `embed:${resp.status}`} kb:${getKbMemoryState()}`;
}

/**
 * Anthropic 1-token ping — pure TLS/pool warm (no cache_control; see header note).
 * Pinged per model: Haiku (answer/dig/close slots) AND Sonnet (the objection card). The
 * objection slot is Sonnet, so without a Sonnet ping the first hotkey press of a call hits
 * a cold model (~6s first token); warming it here brings the cold press near the warm ~2s.
 */
async function warmAnthropic(model: string, label: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return `${label}:skipped(no-key)`;

  const resp = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1,
      messages:   [{ role: "user", content: "warm" }],
    }),
  });
  return resp.ok ? `${label}:ok` : `${label}:${resp.status}`;
}

/** Groq 1-token ping — warms the distiller's connection. */
async function warmGroq(): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return "groq:skipped(no-key)";

  const resp = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method:  "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model:      "llama-3.1-8b-instant",
      max_tokens: 1,
      messages:   [{ role: "user", content: "warm" }],
    }),
  });
  return resp.ok ? "groq:ok" : `groq:${resp.status}`;
}

export async function warmUpPipeline(): Promise<void> {
  const t0 = Date.now();
  const results = await Promise.allSettled([
    warmEmbedAndKb(),
    warmAnthropic("claude-haiku-4-5-20251001", "haiku"),  // answer/dig/close slots
    warmAnthropic("claude-sonnet-4-6", "sonnet"),          // the objection card (live press)
    warmGroq(),
  ]);

  const summary = results
    .map((r) => (r.status === "fulfilled" ? r.value : "ping:rejected"))
    .join(" ");
  console.log(`[warmup] ${summary} in ${Date.now() - t0}ms`);
}
