/**
 * knowledge-search.ts — RAG search layer for the Wingman live call pipeline
 *
 * searchKnowledge(transcriptChunk) does:
 *   1. Embed the chunk with text-embedding-3-small (~80ms)
 *   2. Cosine similarity search against kb_entries via pgvector RPC (~50ms)
 *   3. Filter to matches above 0.72 threshold — return empty if nothing clears it
 *   4. Format results as a clean string for injection into the Haiku prompt
 *   5. Cache the result for 60 seconds to prevent duplicate DB hits
 *
 * Target end-to-end: under 200ms
 * If embedding alone takes >150ms, a LATENCY WARNING is logged.
 */

import { createServiceClient } from "@/lib/supabase/server";

const SIMILARITY_THRESHOLD = 0.72;
const MATCH_COUNT          = 5;
const CACHE_TTL_MS         = 60_000; // 60 seconds

// ── In-process cache ──────────────────────────────────────────────────────────
// Works correctly when Next.js runs as a persistent Node.js server (local Electron
// app or a VPS). On serverless (Vercel), module-level state does not persist between
// invocations — swap this for Redis (REDIS_URL env var) when deploying to Vercel.
interface CacheEntry { result: string; cachedAt: number; }
const cache = new Map<number, CacheEntry>();

function fastHash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h, 33) ^ str.charCodeAt(i);
  }
  return h >>> 0;
}

// ── Return type from the pgvector RPC ────────────────────────────────────────
interface KBMatch {
  id:             string;
  technique_name: string;
  situation:      string;
  exact_script:   string;
  why_it_works:   string;
  call_stage:     string;
  quality_score:  string;
  similarity:     number;
}

// ─────────────────────────────────────────────────────────────────────────────

export async function searchKnowledge(transcriptChunk: string): Promise<string> {
  const query = transcriptChunk.trim();
  if (!query) return "";

  // ── Cache lookup ──────────────────────────────────────────────────────────
  const key    = fastHash(query);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.result;
  }

  // Prune expired entries
  for (const [k, v] of cache) {
    if (Date.now() - v.cachedAt > CACHE_TTL_MS) cache.delete(k);
  }

  const t0 = Date.now();

  // ── 1. Embed the transcript chunk ─────────────────────────────────────────
  // Using raw fetch (same pattern as the poll route) — no openai package needed.
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error("[searchKnowledge] OPENAI_API_KEY not set");
    return "";
  }

  let embedding: number[];
  try {
    const embedResp = await fetch("https://api.openai.com/v1/embeddings", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: query,
      }),
    });

    if (!embedResp.ok) {
      const err = await embedResp.text();
      console.error("[searchKnowledge] OpenAI embed error:", err);
      return "";
    }

    const embedData = await embedResp.json() as { data: [{ embedding: number[] }] };
    embedding = embedData.data[0].embedding;
  } catch (err) {
    console.error("[searchKnowledge] Embedding request failed:", err);
    return "";
  }

  const embedMs = Date.now() - t0;
  if (embedMs > 150) {
    console.warn(`[searchKnowledge] ⚠️  Embedding took ${embedMs}ms — approaching 200ms latency target`);
  }

  // ── 2. pgvector cosine similarity search ─────────────────────────────────
  const supabase = createServiceClient();
  let matches: KBMatch[] = [];

  try {
    const { data, error } = await supabase.rpc("search_kb_entries", {
      query_embedding:      embedding,
      similarity_threshold: SIMILARITY_THRESHOLD,
      match_count:          MATCH_COUNT,
    });

    if (error) throw error;
    matches = (data as KBMatch[]) ?? [];
  } catch (err) {
    console.error("[searchKnowledge] Vector search failed:", err);
    return "";
  }

  const totalMs = Date.now() - t0;
  console.log(`[searchKnowledge] ${matches.length} match(es) in ${totalMs}ms`);

  if (totalMs > 200) {
    console.warn(`[searchKnowledge] ⚠️  LATENCY EXCEEDED: ${totalMs}ms > 200ms target — consider adding Redis cache or upgrading pgvector index`);
  }

  // Nothing cleared 0.72 — do not return weak matches to fill the quota
  if (matches.length === 0) return "";

  // ── 3. Format for prompt injection ───────────────────────────────────────
  // Keep to top 3 matches to stay within the ~450-token KB budget (see architecture diagram).
  // Each entry runs ~100-200 tokens; 3 × 150 = ~450 tokens ✓
  const top3 = matches.slice(0, 3);

  const result = [
    "RELEVANT SALES TECHNIQUES FROM KNOWLEDGE BASE:",
    ...top3.map((m, i) =>
      `[TECHNIQUE ${i + 1}]\nName: ${m.technique_name}\nStage: ${m.call_stage}\nWhen to use: ${m.situation}\nScript: ${m.exact_script}\nWhy it works: ${m.why_it_works}`
    ),
  ].join("\n\n");

  // ── 4. Cache ──────────────────────────────────────────────────────────────
  cache.set(key, { result, cachedAt: Date.now() });

  return result;
}
