-- ─── KB v3: Dual KB Architecture ─────────────────────────────────────────────
-- Splits the single kb_entries table into two purpose-built tables:
--   kb_signal_card_entries  → live signal cards only (surgical, high bar)
--   kb_coaching_entries     → Mission Intel chatbot (broad, everything)
--
-- Safe to run on a live DB:
--   - Rename is atomic (no data loss, no downtime)
--   - RPC is replaced atomically
--   - New table is additive only
-- ─────────────────────────────────────────────────────────────────────────────

-- ── STEP 1: Rename kb_entries → kb_signal_card_entries ───────────────────────
-- All existing data, columns, constraints, and indexes move with the table.
-- The old RPC (search_kb_entries) still references the old name, so we
-- replace it in Step 2 before anything can break.

ALTER TABLE public.kb_entries
  RENAME TO kb_signal_card_entries;

-- ── STEP 2: Replace the search RPC ───────────────────────────────────────────
-- Drop old function (pointed at old table name), create new one.
-- Everything else (return columns, logic, thresholds) stays identical.

DROP FUNCTION IF EXISTS search_kb_entries(vector, float, integer);

CREATE OR REPLACE FUNCTION search_kb_signal_card_entries(
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
      kb_signal_card_entries.id,
      kb_signal_card_entries.technique_name,
      kb_signal_card_entries.situation,
      kb_signal_card_entries.exact_script,
      kb_signal_card_entries.why_it_works,
      kb_signal_card_entries.call_stage,
      kb_signal_card_entries.quality_score,
      -- Weighted: 70% prospect match + 30% technique match.
      -- COALESCE so a NULL embedding contributes 0 instead of NULLing the row.
      (
        COALESCE(0.7 * (1 - (kb_signal_card_entries.prospect_embedding  <=> query_embedding)), 0) +
        COALESCE(0.3 * (1 - (kb_signal_card_entries.technique_embedding <=> query_embedding)), 0)
      )::float AS similarity
    FROM public.kb_signal_card_entries
    WHERE
      kb_signal_card_entries.trigger_speaker = 'prospect'
      AND kb_signal_card_entries.quality_score IN ('high', 'medium')
      AND (
        -- Primary: prospect_embedding match at full threshold
        (1 - (kb_signal_card_entries.prospect_embedding <=> query_embedding)) >= similarity_threshold
        OR
        -- Fallback: entries without prospect_embedding, use technique_embedding
        (
          kb_signal_card_entries.prospect_embedding IS NULL
          AND (1 - (kb_signal_card_entries.technique_embedding <=> query_embedding)) >= 0.65
        )
      )
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- ── STEP 3: Create kb_coaching_entries ───────────────────────────────────────
-- Broad table for Mission Intel chatbot. Lower bar than signal cards.
-- Stores full explanations, frameworks, mindset content, habits — anything
-- real sales training content. Single embedding (topic + content combined).
-- No prospect_triggers or exact_script requirement.

CREATE TABLE public.kb_coaching_entries (
  id           UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_id    UUID        NOT NULL REFERENCES public.kb_sources(id) ON DELETE CASCADE,
  topic        TEXT        NOT NULL,  -- what this technique/concept is about
  content      TEXT        NOT NULL,  -- full explanation (can be long)
  coach_name   TEXT,
  call_stage   TEXT        CHECK (call_stage IN ('Rapport', 'Discovery', 'Press', 'Confirm', 'Pitch', 'Close') OR call_stage IS NULL),
  content_type TEXT,                  -- technique, mindset, framework, habit, objection_handling, etc.
  tags         TEXT,                  -- comma-separated topics
  embedding    vector(1536),          -- embedded from topic + content combined
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── STEP 4: Indexes for kb_coaching_entries ───────────────────────────────────
-- Standard lookup indexes. IVFFlat vector index is NOT created here —
-- same pattern as kb_signal_card_entries: build it after the table is populated.
-- Building an ivfflat index on an empty or mostly-empty table is wasteful.

CREATE INDEX idx_kb_coaching_source_id  ON public.kb_coaching_entries(source_id);
CREATE INDEX idx_kb_coaching_coach_name ON public.kb_coaching_entries(coach_name);

-- ── STEP 5: Create coaching search RPC ───────────────────────────────────────
-- Simpler than the signal card RPC: single-vector cosine search.
-- Lower default threshold (0.60) because coaching content is broader —
-- we'd rather surface a relevant framework than return nothing.
-- Higher default match_count (5) because chatbot responses benefit from more context.

CREATE OR REPLACE FUNCTION search_kb_coaching(
  query_embedding      vector(1536),
  similarity_threshold float   DEFAULT 0.60,
  match_count          integer DEFAULT 5
)
RETURNS TABLE (
  id           uuid,
  topic        text,
  content      text,
  coach_name   text,
  call_stage   text,
  content_type text,
  similarity   float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
    SELECT
      kb_coaching_entries.id,
      kb_coaching_entries.topic,
      kb_coaching_entries.content,
      kb_coaching_entries.coach_name,
      kb_coaching_entries.call_stage,
      kb_coaching_entries.content_type,
      (1 - (kb_coaching_entries.embedding <=> query_embedding))::float AS similarity
    FROM public.kb_coaching_entries
    WHERE
      kb_coaching_entries.embedding IS NOT NULL
      AND (1 - (kb_coaching_entries.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY kb_coaching_entries.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ── DONE ──────────────────────────────────────────────────────────────────────
-- After running this migration:
--   1. Update code: kb_entries → kb_signal_card_entries, search_kb_entries → search_kb_signal_card_entries
--   2. Run backfill-coaching.js to populate kb_coaching_entries from existing data
--   3. Run cleanup.js --apply to delete 215 bad signal card entries
-- ─────────────────────────────────────────────────────────────────────────────
