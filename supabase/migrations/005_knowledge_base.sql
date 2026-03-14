-- ─── PHASE 1: Wingman Knowledge Base ─────────────────────────────────────────
-- Run this in Supabase SQL editor after getting approval.
-- Requires: uuid-ossp (already enabled in 001_initial_schema.sql)

-- ── Enable pgvector ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── kb_sources ────────────────────────────────────────────────────────────────
-- One row per YouTube video. Tracks ingestion status and cost.
CREATE TABLE public.kb_sources (
  id               UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  youtube_url      TEXT        NOT NULL UNIQUE,
  video_title      TEXT,
  channel_name     TEXT,
  coach_name       TEXT,
  duration_seconds INTEGER,
  entry_count      INTEGER     DEFAULT 0,
  processing_cost  NUMERIC(10, 6) DEFAULT 0,  -- USD: whisper + claude + embeddings
  status           TEXT        NOT NULL DEFAULT 'processing'
                               CHECK (status IN ('processing', 'complete', 'failed')),
  error_message    TEXT,
  processed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── kb_entries ────────────────────────────────────────────────────────────────
-- Every extracted sales technique lives here with a 1536-dim embedding.
CREATE TABLE public.kb_entries (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_id       UUID NOT NULL REFERENCES public.kb_sources(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,        -- free text, Claude names it
  trigger_phrase  TEXT NOT NULL,        -- what the prospect says / call situation
  technique_name  TEXT NOT NULL,        -- short memorable label
  full_detail     TEXT NOT NULL,        -- complete technique, nothing stripped
  coach_name      TEXT,
  embedding       vector(1536),         -- text-embedding-3-small output
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Vector similarity index ───────────────────────────────────────────────────
-- IVFFlat with 100 lists — good for up to ~1M entries at low query latency.
-- If your kb_entries table later exceeds 500k rows, bump lists to 200-500.
CREATE INDEX ON public.kb_entries
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ── Standard indexes ─────────────────────────────────────────────────────────
CREATE INDEX idx_kb_sources_youtube_url ON public.kb_sources(youtube_url);
CREATE INDEX idx_kb_sources_status      ON public.kb_sources(status);
CREATE INDEX idx_kb_entries_source_id   ON public.kb_entries(source_id);
CREATE INDEX idx_kb_entries_coach_name  ON public.kb_entries(coach_name);

-- ── Similarity search RPC ────────────────────────────────────────────────────
-- Called by searchKnowledge() in the Next.js app via supabase.rpc().
-- Returns matches above the similarity threshold, ordered best-first.
CREATE OR REPLACE FUNCTION search_kb_entries(
  query_embedding      vector(1536),
  similarity_threshold float   DEFAULT 0.78,
  match_count          integer DEFAULT 5
)
RETURNS TABLE (
  id             uuid,
  technique_name text,
  trigger_phrase text,
  full_detail    text,
  coach_name     text,
  similarity     float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
    SELECT
      kb_entries.id,
      kb_entries.technique_name,
      kb_entries.trigger_phrase,
      kb_entries.full_detail,
      kb_entries.coach_name,
      (1 - (kb_entries.embedding <=> query_embedding))::float AS similarity
    FROM public.kb_entries
    WHERE (1 - (kb_entries.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY kb_entries.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
