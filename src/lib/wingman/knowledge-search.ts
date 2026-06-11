/**
 * knowledge-search.ts — RAG search layer for the Wingman live call pipeline
 *
 * searchKnowledge(transcriptChunk) does:
 *   1. Embed the chunk with text-embedding-3-small (~80ms)
 *   2. Cosine similarity search against kb_prospect_triggers via pgvector RPC (~50ms)
 *   3. Filter to matches above 0.72 threshold — return empty if nothing clears it
 *   4. Format results as a clean string for injection into the Haiku prompt
 *   5. Cache the result for 60 seconds to prevent duplicate DB hits
 *
 * Target end-to-end: under 200ms
 * If embedding alone takes >150ms, a LATENCY WARNING is logged.
 */

import { createServiceClient } from "@/lib/supabase/server";

const SIMILARITY_THRESHOLD = 0.65;
const MATCH_COUNT          = 5;
const CACHE_TTL_MS         = 60_000; // 60 seconds
const EMBED_TIMEOUT_MS     = 5_000;  // abort OpenAI call if it hangs mid-call

// Phase 3.5 — options for the distilled-query path (see kb-signal/route.ts):
// - threshold: the distilled query is short + objection-shaped and only exists when
//   Groq confirmed a real objection, so 0.60+ on it is an honest match, not smoothie
//   noise (probes 2026-06-11: real matches 0.60–0.75, noise ≤0.51). Default stays 0.65.
// - skipCache: degraded mode (Groq down) embeds the raw 120s buffer, whose cache key
//   barely changes between presses — a 60s-stale entry can serve the PREVIOUS
//   objection's technique for a new one. Skip the cache rather than compound wrongness.
export interface SearchKnowledgeOptions {
  threshold?: number;
  skipCache?: boolean;
}

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
  id:              string;
  technique_name:  string;
  situation:       string;
  exact_script:    string;
  why_it_works:    string;
  call_stage:      string;
  quality_score:   string;
  similarity:      number;
  matched_trigger: string;  // which specific trigger phrase matched — useful for logs
}

// ─────────────────────────────────────────────────────────────────────────────

export async function searchKnowledge(
  transcriptChunk: string,
  options: SearchKnowledgeOptions = {},
): Promise<string> {
  const query     = transcriptChunk.trim();
  if (!query) return "";

  const threshold = options.threshold ?? SIMILARITY_THRESHOLD;

  // ── Cache lookup ──────────────────────────────────────────────────────────
  // Key includes the threshold so a 0.60 distilled search never serves a result
  // cached by a 0.65 search of the same text (and vice versa).
  const key    = fastHash(`${threshold}|${query}`);
  const cached = options.skipCache ? undefined : cache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.result;
  }

  // Prune expired entries
  for (const [k, v] of cache) {
    if (Date.now() - v.cachedAt > CACHE_TTL_MS) cache.delete(k);
  }

  const t0 = Date.now();

  // ── 1. Embed the transcript chunk ─────────────────────────────────────────
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error("[searchKnowledge] OPENAI_API_KEY not set");
    return "";
  }

  let embedding: number[];
  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);

    let embedResp: Response;
    try {
      embedResp = await fetch("https://api.openai.com/v1/embeddings", {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type":  "application/json",
        },
        body:   JSON.stringify({ model: "text-embedding-3-small", input: query }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

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

  // ── 2. pgvector cosine similarity search (junction table) ─────────────────
  // search_kb_by_trigger: per-phrase embeddings → best trigger per technique →
  // top N techniques by similarity. Returns matched_trigger for logging.
  const supabase = createServiceClient();
  let matches: KBMatch[] = [];

  try {
    const { data, error } = await supabase.rpc("search_kb_by_trigger", {
      query_embedding:      embedding,
      similarity_threshold: threshold,
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
  if (matches.length > 0) {
    console.log(`[searchKnowledge] Top match: "${matches[0].technique_name}" (${matches[0].similarity.toFixed(3)}) via trigger: "${matches[0].matched_trigger}"`);
  }

  if (totalMs > 200) {
    console.warn(`[searchKnowledge] ⚠️  LATENCY EXCEEDED: ${totalMs}ms > 200ms target`);
  }

  if (matches.length === 0) return "";

  // ── 3. Format for prompt injection ───────────────────────────────────────
  // Top 3 to stay within the ~450-token KB budget.
  const top3 = matches.slice(0, 3);

  const result = [
    "RELEVANT SALES TECHNIQUES FROM KNOWLEDGE BASE:",
    ...top3.map((m, i) =>
      `[TECHNIQUE ${i + 1}]\nName: ${m.technique_name}\nStage: ${m.call_stage}\nWhen to use: ${m.situation}\nScript: ${m.exact_script}\nWhy it works: ${m.why_it_works}`
    ),
  ].join("\n\n");

  // ── 4. Cache ──────────────────────────────────────────────────────────────
  if (!options.skipCache) {
    cache.set(key, { result, cachedAt: Date.now() });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// searchCoachingKnowledge — used by Mission Intel chatbot only
//
// Searches kb_coaching_entries (broad, explanatory content) rather than the
// live-call signal card table. Lower similarity threshold (0.60) and more
// results (5) because coaching benefits from broader context.
// ─────────────────────────────────────────────────────────────────────────────

interface CoachingCacheEntry { result: string; cachedAt: number; }
const coachingCache = new Map<number, CoachingCacheEntry>();

interface CoachingKBMatch {
  id:           string;
  topic:        string;
  content:      string;
  coach_name:   string | null;
  call_stage:   string | null;
  content_type: string | null;
  similarity:   number;
}

export async function searchCoachingKnowledge(query: string): Promise<string> {
  const q = query.trim();
  if (!q) return "";

  // ── Cache lookup ──────────────────────────────────────────────────────────
  const key    = fastHash(q);
  const cached = coachingCache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.result;
  }

  for (const [k, v] of coachingCache) {
    if (Date.now() - v.cachedAt > CACHE_TTL_MS) coachingCache.delete(k);
  }

  // ── Embed the query ───────────────────────────────────────────────────────
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error("[searchCoachingKnowledge] OPENAI_API_KEY not set");
    return "";
  }

  let embedding: number[];
  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 8_000);

    let embedResp: Response;
    try {
      embedResp = await fetch("https://api.openai.com/v1/embeddings", {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type":  "application/json",
        },
        body:   JSON.stringify({ model: "text-embedding-3-small", input: q }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!embedResp.ok) {
      const err = await embedResp.text();
      console.error("[searchCoachingKnowledge] OpenAI embed error:", err);
      return "";
    }

    const embedData = await embedResp.json() as { data: [{ embedding: number[] }] };
    embedding = embedData.data[0].embedding;
  } catch (err) {
    console.error("[searchCoachingKnowledge] Embedding failed:", err);
    return "";
  }

  // ── pgvector search against kb_coaching_entries ───────────────────────────
  const supabase = createServiceClient();
  let matches: CoachingKBMatch[] = [];

  try {
    const { data, error } = await supabase.rpc("search_kb_coaching", {
      query_embedding:      embedding,
      similarity_threshold: 0.60,
      match_count:          5,
    });

    if (error) throw error;
    matches = (data as CoachingKBMatch[]) ?? [];
  } catch (err) {
    console.error("[searchCoachingKnowledge] Vector search failed:", err);
    return "";
  }

  console.log(`[searchCoachingKnowledge] ${matches.length} match(es)`);
  if (matches.length === 0) return "";

  // ── Format for prompt injection ───────────────────────────────────────────
  // Content capped at 500 chars per entry to stay within token budget.
  const result = matches
    .map((m, i) => {
      const stageLabel = m.call_stage ? ` (${m.call_stage})` : "";
      const content    = m.content.length > 500 ? m.content.slice(0, 500) + "…" : m.content;
      return `[COACHING ${i + 1}] ${m.topic}${stageLabel}\n${content}`;
    })
    .join("\n\n");

  coachingCache.set(key, { result, cachedAt: Date.now() });
  return result;
}
