-- ─── KB v2: Dual-Vector Ingestion Schema ─────────────────────────────────────
-- Run in Supabase SQL Editor AFTER deploying code changes to Railway.
-- Deploy order: code → this migration → re-ingestion → ivfflat index (ingest.js)
--
-- Safe to run on live DB: only adds columns, renames one column, replaces RPC.
-- Existing kb_entries rows remain queryable throughout (graceful degradation).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── STEP 1: Add new columns ───────────────────────────────────────────────────
-- quality_score DEFAULT 'medium': existing entries pass the RPC filter immediately.
-- trigger_speaker DEFAULT 'prospect': existing entries pass the speaker filter.
-- call_stage allows NULL: existing entries have no stage set (no constraint failure).

ALTER TABLE public.kb_entries
  ADD COLUMN IF NOT EXISTS prospect_triggers              TEXT,
  ADD COLUMN IF NOT EXISTS exact_script                   TEXT,
  ADD COLUMN IF NOT EXISTS situation                      TEXT,
  ADD COLUMN IF NOT EXISTS why_it_works                   TEXT,
  ADD COLUMN IF NOT EXISTS content_type                   TEXT,
  ADD COLUMN IF NOT EXISTS call_stage                     TEXT,
  ADD COLUMN IF NOT EXISTS quality_score                  TEXT    DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS prospect_embedding             vector(1536),
  ADD COLUMN IF NOT EXISTS sequence_id                    UUID,
  ADD COLUMN IF NOT EXISTS sequence_step                  INTEGER,
  ADD COLUMN IF NOT EXISTS sequence_total_steps           INTEGER,
  ADD COLUMN IF NOT EXISTS sequence_follow_up_triggers    TEXT,
  ADD COLUMN IF NOT EXISTS trigger_speaker                TEXT    DEFAULT 'prospect',
  ADD COLUMN IF NOT EXISTS rep_trigger_pattern            TEXT,
  ADD COLUMN IF NOT EXISTS rep_trigger_condition          TEXT;

-- ── STEP 2: Backfill existing rows so they pass RPC filters ───────────────────
-- The DEFAULT above handles new rows. This covers rows that already existed
-- before this migration ran (where DEFAULT is not applied retroactively).

UPDATE public.kb_entries
  SET quality_score = 'medium'
  WHERE quality_score IS NULL;

UPDATE public.kb_entries
  SET trigger_speaker = 'prospect'
  WHERE trigger_speaker IS NULL;

-- ── STEP 3: Add CHECK constraints ─────────────────────────────────────────────
-- These make typos ('High', 'DISCOVERY') fail loudly at insert time
-- rather than silently excluding entries from search results.

ALTER TABLE public.kb_entries
  ADD CONSTRAINT quality_score_check
    CHECK (quality_score IN ('high', 'medium', 'low')),
  ADD CONSTRAINT call_stage_check
    CHECK (call_stage IN ('Rapport', 'Discovery', 'Press', 'Confirm', 'Pitch', 'Close')
           OR call_stage IS NULL),
  ADD CONSTRAINT trigger_speaker_check
    CHECK (trigger_speaker IN ('prospect', 'rep'));

-- ── STEP 4: Rename embedding → technique_embedding ────────────────────────────
-- The existing ivfflat index on this column is automatically updated by Postgres.
-- No need to rebuild the index after rename.

ALTER TABLE public.kb_entries
  RENAME COLUMN embedding TO technique_embedding;

-- ── STEP 5: Drop old RPC, create new dual-vector version ─────────────────────
-- New RPC returns exact_script and why_it_works so Haiku can use them.
-- COALESCE handles NULL embeddings during the re-ingestion window:
--   Old entries (NULL prospect_embedding) contribute 0 on the prospect side
--   but still surface via technique_embedding. Max score = 0.3 (below 0.72).
--   They fall back to the OR condition (technique_embedding >= 0.65).

DROP FUNCTION IF EXISTS search_kb_entries(vector, float, integer);

CREATE OR REPLACE FUNCTION search_kb_entries(
  query_embedding      vector(1536),
  similarity_threshold float   DEFAULT 0.72,
  match_count          integer DEFAULT 3
)
RETURNS TABLE (
  id              uuid,
  technique_name  text,
  situation       text,
  exact_script    text,
  why_it_works    text,
  call_stage      text,
  quality_score   text,
  similarity      float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
    SELECT
      kb_entries.id,
      kb_entries.technique_name,
      kb_entries.situation,
      kb_entries.exact_script,
      kb_entries.why_it_works,
      kb_entries.call_stage,
      kb_entries.quality_score,
      -- Weighted: 70% prospect match + 30% technique match.
      -- COALESCE(x, 0) so a NULL embedding contributes 0 instead of NULLing the row.
      (
        COALESCE(0.7 * (1 - (kb_entries.prospect_embedding  <=> query_embedding)), 0) +
        COALESCE(0.3 * (1 - (kb_entries.technique_embedding <=> query_embedding)), 0)
      )::float AS similarity
    FROM public.kb_entries
    WHERE
      kb_entries.trigger_speaker = 'prospect'
      AND kb_entries.quality_score IN ('high', 'medium')
      AND (
        -- Primary: prospect_embedding match at full threshold
        (1 - (kb_entries.prospect_embedding <=> query_embedding)) >= similarity_threshold
        OR
        -- Fallback: old entries without prospect_embedding, use technique_embedding
        (
          kb_entries.prospect_embedding IS NULL
          AND (1 - (kb_entries.technique_embedding <=> query_embedding)) >= 0.65
        )
      )
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- ── DONE ──────────────────────────────────────────────────────────────────────
-- ivfflat index on prospect_embedding is NOT created here.
-- It will be created by ingest.js after all 37 sources finish re-ingesting.
-- Building it on a mostly-NULL column is wasteful and produces a degraded index.
--
-- Next step: verify migration ran cleanly, then proceed to Step 2 (ingest.js rewrite).
-- ─────────────────────────────────────────────────────────────────────────────
