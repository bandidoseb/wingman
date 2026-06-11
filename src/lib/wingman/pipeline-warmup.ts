/**
 * pipeline-warmup.ts — Phase 3.5 (#38) connection warm-up.
 *
 * WHY: the first request to each external service pays one-time setup — DNS,
 * TLS handshake, connection-pool open, and (for pgvector) waking the index.
 * Live samples showed that cold cost dominating press-to-card latency
 * (embedding 1.5–1.7s cold vs ~0.2s warm; search 3.9s cold). Firing tiny
 * throwaway requests at CALL START moves that cost to a moment nobody is
 * waiting, so the rep's FIRST hotkey press behaves like a warm one.
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

import { createServiceClient } from "@/lib/supabase/server";

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

/** OpenAI embed ping → pgvector RPC ping (chained: the RPC needs a real vector). */
async function warmEmbedAndSearch(): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return "embed:skipped(no-key)";

  const resp = await fetchWithTimeout("https://api.openai.com/v1/embeddings", {
    method:  "POST",
    headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ model: "text-embedding-3-small", input: "warm" }),
  });
  if (!resp.ok) return `embed:${resp.status}`;

  const data      = await resp.json() as { data: [{ embedding: number[] }] };
  const embedding = data.data?.[0]?.embedding;
  if (!embedding) return "embed:ok rpc:skipped(no-vector)";

  // Threshold 0.99 → touches the HNSW index (the part that needs waking) while
  // returning at most nothing.
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.rpc("search_kb_by_trigger", {
      query_embedding:      embedding,
      similarity_threshold: 0.99,
      match_count:          1,
    });
    return error ? `embed:ok rpc:${error.code ?? "error"}` : "embed:ok rpc:ok";
  } catch {
    return "embed:ok rpc:failed";
  }
}

/** Anthropic 1-token ping — pure TLS/pool warm (no cache_control; see header note). */
async function warmAnthropic(): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "haiku:skipped(no-key)";

  const resp = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages:   [{ role: "user", content: "warm" }],
    }),
  });
  return resp.ok ? "haiku:ok" : `haiku:${resp.status}`;
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
    warmEmbedAndSearch(),
    warmAnthropic(),
    warmGroq(),
  ]);

  const summary = results
    .map((r) => (r.status === "fulfilled" ? r.value : "ping:rejected"))
    .join(" ");
  console.log(`[warmup] ${summary} in ${Date.now() - t0}ms`);
}
