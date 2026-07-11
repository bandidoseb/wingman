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
import { DIG_SYSTEM_PROMPT, buildDigUserSegments } from "./dig-prompt.mjs";
import { buildSalesDnaBlock } from "./sales-dna.mjs";

const PING_TIMEOUT_MS = 4_000;
// The Sales DNA cache prime is a real (small) generation against a cold model —
// first-token latency can run ~6s cold. Aborting early would cancel the request
// and lose the cache write we came for, so it gets its own longer leash.
const PRIME_TIMEOUT_MS = 12_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = PING_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), timeoutMs);
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

/**
 * Sonnet warm + Sales DNA cache prime (Phase 1b, Sebastian's warm-at-deploy idea).
 *
 * With a COMPLETE Sales DNA: instead of the generic 1-token Sonnet ping, send the
 * REAL dig-card prefix — DIG_SYSTEM_PROMPT + the rep's Sales DNA segment with its
 * cache_control breakpoint — at max_tokens:1. That writes the prompt cache at
 * deploy, so the rep's FIRST ↓ press hits a warm cache (prefix read at ~10% cost,
 * faster prefill) instead of paying the cache write mid-press. The TLS/pool warm
 * rides along (it IS a Sonnet request), so this REPLACES the generic ping — never
 * runs alongside it (don't warm Sonnet twice).
 *
 * BYTE-IDENTITY IS THE WHOLE GAME: the segment comes from the same
 * buildDigUserSegments the press path uses — any divergence and the prime is a
 * silent waste. The press sends [DNA, summary, latest]; the prime sends only [DNA].
 * Anthropic hashes the prefix up to the breakpoint (system + DNA block), which is
 * identical in both — so the prime's cache entry serves every press.
 *
 * HONEST CAVEATS (documented, accepted):
 *   - Cache TTL is 5 min from last use. A first press >5 min after deploy misses
 *     anyway; the prime cost (~1.25× on a ~2k-token prefix ≈ <$0.01) is small
 *     enough to be worth it for the presses that land early.
 *   - Session create fires only AFTER recording confirms (DashboardClient), so a
 *     Deploy that never finds a meeting pays nothing.
 *
 * Without a complete Sales DNA there is nothing stable to prime — fall back to
 * the plain 1-token connection ping, byte-for-byte the pre-1b behavior.
 */
async function warmSonnetAndPrimeDigCache(salesDna: Record<string, string> | null): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "sonnet:skipped(no-key)";

  if (!buildSalesDnaBlock(salesDna)) {
    // No (complete) DNA → plain connection warm, exactly as before.
    return warmAnthropic("claude-sonnet-4-6", "sonnet");
  }

  // segments[0] is the DNA segment (cache:true) — the press path's exact bytes.
  const dnaSegment = (buildDigUserSegments({ salesDna }) as Array<{ text: string; cache: boolean }>)[0];

  const resp = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method:  "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-6", // must match dig-signal's DIG_MODEL — cache is per-model
        max_tokens: 1,
        system:     DIG_SYSTEM_PROMPT,
        messages:   [{
          role:    "user",
          content: [{ type: "text", text: dnaSegment.text, cache_control: { type: "ephemeral" } }],
        }],
      }),
    },
    PRIME_TIMEOUT_MS,
  );

  if (!resp.ok) return `sonnet-prime:${resp.status}`;
  // Prove the prime actually wrote (or re-read) the cache — never assume.
  const usage = (await resp.json().catch(() => ({})))?.usage ?? {};
  return `sonnet-prime:ok(created=${usage.cache_creation_input_tokens ?? 0},read=${usage.cache_read_input_tokens ?? 0})`;
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

/**
 * @param salesDna — the rep's sanitized Sales DNA (from the session-create body).
 *   Complete DNA upgrades the Sonnet ping into a dig-prefix cache prime; anything
 *   else keeps the pre-1b generic ping. Optional so other callers are unaffected.
 */
export async function warmUpPipeline(salesDna: Record<string, string> | null = null): Promise<void> {
  const t0 = Date.now();
  const results = await Promise.allSettled([
    warmEmbedAndKb(),
    warmAnthropic("claude-haiku-4-5-20251001", "haiku"),  // answer/close slots
    warmSonnetAndPrimeDigCache(salesDna),                  // objection + dig (Sonnet) — primes the DNA cache when briefed
    warmGroq(),
  ]);

  const summary = results
    .map((r) => (r.status === "fulfilled" ? r.value : "ping:rejected"))
    .join(" ");
  console.log(`[warmup] ${summary} in ${Date.now() - t0}ms`);
}
