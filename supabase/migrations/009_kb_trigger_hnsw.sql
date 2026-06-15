-- ─── 009: Fast fallback — HNSW index + index-friendly search_kb_by_trigger ───
--
-- WHY
-- ---
-- The live press path now searches the KB in the Node server's memory (see
-- src/lib/wingman/kb-memory.ts) — ~10ms, exact. The Supabase RPC below is only
-- the FALLBACK used in the few seconds after a deploy before memory is ready,
-- or if the memory load fails. Today that fallback is the SLOW path: measured
-- ~2.3s (EXPLAIN ANALYZE = 2,091ms) because the old query shape
-- (`DISTINCT ON (e.id) ... ORDER BY e.id, distance`) forces a sequential scan of
-- all ~6,554 vectors and cannot use a vector index.
--
-- This migration makes the fallback fast too (~100–300ms), so a deploy window or
-- a memory-load failure degrades to "slightly slower" instead of "2.3s stampede."
--
-- WHAT CHANGES
-- ------------
--   1. Adds an HNSW index on kb_prospect_triggers.embedding (cosine).
--   2. Rewrites search_kb_by_trigger to a two-stage query: stage 1 uses the HNSW
--      index to grab the ~100 nearest trigger vectors (the part that must be
--      fast), stage 2 applies the entry-level filters + best-trigger-per-entry
--      dedupe on just those ~100 rows. IDENTICAL signature + return columns, so
--      no application code changes.
--
-- SAFETY
-- ------
--   • Additive + replace-in-place. No data is moved or deleted.
--   • CREATE INDEX is non-CONCURRENT (locks writes briefly). The KB is only
--     written by the local ingestion tool, never by the live app, so a short
--     lock during this one-time build is harmless. At 6,554 rows it takes
--     seconds.
--   • The rewritten RPC is APPROXIMATE (HNSW). That is correct here: it's the
--     fallback; the exact path is in-memory. ef_search=100 keeps recall high.
--
-- HOW TO RUN: paste this whole file into the Supabase SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── STEP 1: HNSW index on the trigger embeddings ─────────────────────────────
-- vector_cosine_ops matches the `<=>` cosine-distance operator the RPC uses.
CREATE INDEX IF NOT EXISTS idx_kb_prospect_triggers_embedding_hnsw
  ON public.kb_prospect_triggers
  USING hnsw (embedding vector_cosine_ops);

-- Refresh planner stats so it actually chooses the new index.
ANALYZE public.kb_prospect_triggers;

-- ── STEP 2: Index-friendly rewrite (identical signature + columns) ───────────
CREATE OR REPLACE FUNCTION search_kb_by_trigger(
  query_embedding      vector(1536),
  similarity_threshold float   DEFAULT 0.72,
  match_count          integer DEFAULT 5
)
RETURNS TABLE (
  id              uuid,
  technique_name  text,
  situation       text,
  exact_script    text,
  why_it_works    text,
  call_stage      text,
  quality_score   text,
  similarity      float,
  matched_trigger text
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Widen the HNSW candidate list for better recall (default 40). 100 candidates
  -- over ~6.5k rows is still single-digit-ms and comfortably yields ≥ match_count
  -- eligible entries after the speaker/quality filter + dedupe.
  PERFORM set_config('hnsw.ef_search', '100', true);

  RETURN QUERY
  WITH nearest AS (
    -- STAGE 1 — index-ordered nearest ELIGIBLE triggers. The entry filters live
    -- here (filter-then-rank), exactly mirroring migration 008's semantics, so
    -- ineligible rows (rep-speaker / low-quality, which the schema permits and a
    -- future feature may add) can never crowd out real matches and make this
    -- return fewer than match_count. The HNSW index still drives ORDER BY ...
    -- LIMIT; Postgres pulls index candidates in distance order and applies the
    -- join filter until the LIMIT is satisfied.
    SELECT
      e.id AS entry_id,
      e.technique_name,
      e.situation,
      e.exact_script,
      e.why_it_works,
      e.call_stage,
      e.quality_score,
      t.trigger_text,
      (t.embedding <=> query_embedding) AS dist
    FROM public.kb_prospect_triggers t
    JOIN public.kb_signal_card_entries e ON t.entry_id = e.id
    WHERE
      t.embedding IS NOT NULL
      AND e.quality_score IN ('high', 'medium')
      AND e.trigger_speaker = 'prospect'
    ORDER BY t.embedding <=> query_embedding
    LIMIT 100
  ),
  best AS (
    -- STAGE 2 — best-trigger-per-entry + threshold on just those ~100 rows.
    SELECT DISTINCT ON (n.entry_id)
      n.entry_id AS id,
      n.technique_name,
      n.situation,
      n.exact_script,
      n.why_it_works,
      n.call_stage,
      n.quality_score,
      (1 - n.dist)::float AS similarity,
      n.trigger_text      AS matched_trigger
    FROM nearest n
    WHERE (1 - n.dist) >= similarity_threshold
    ORDER BY n.entry_id, n.dist ASC
  )
  SELECT
    best.id,
    best.technique_name,
    best.situation,
    best.exact_script,
    best.why_it_works,
    best.call_stage,
    best.quality_score,
    best.similarity,
    best.matched_trigger
  FROM best
  ORDER BY best.similarity DESC
  LIMIT match_count;
END;
$$;

-- ── VERIFY (optional) ─────────────────────────────────────────────────────────
-- Re-run your EXPLAIN ANALYZE; "Execution Time" should drop from ~2,000ms to a
-- few hundred ms or less, and the plan should show an Index Scan using
-- idx_kb_prospect_triggers_embedding_hnsw (not a Seq Scan):
--
--   EXPLAIN ANALYZE
--   SELECT * FROM search_kb_by_trigger(
--     (SELECT embedding FROM kb_prospect_triggers LIMIT 1), 0.60, 5);
-- ─────────────────────────────────────────────────────────────────────────────
