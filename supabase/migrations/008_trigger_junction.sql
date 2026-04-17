-- ─── KB v4: Prospect Trigger Junction Table ─────────────────────────────────
-- Replaces the diluted "30 phrases as one vector" prospect_embedding approach.
-- Each prospect trigger phrase gets its own embedding row in kb_prospect_triggers.
-- Result: similarity scores go from ~0.38 to 0.80+ for correct matches.
--
-- Safe to run on live DB:
--   - New table only (additive)
--   - Existing kb_signal_card_entries untouched
--   - Old search_kb_signal_card_entries RPC still works during transition
-- ─────────────────────────────────────────────────────────────────────────────

-- ── STEP 1: Create kb_prospect_triggers ──────────────────────────────────────
-- One row per trigger phrase. ON DELETE CASCADE means deleting an entry from
-- kb_signal_card_entries automatically cleans up all its trigger rows.

CREATE TABLE public.kb_prospect_triggers (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id     UUID        NOT NULL REFERENCES public.kb_signal_card_entries(id) ON DELETE CASCADE,
  trigger_text TEXT        NOT NULL,
  embedding    vector(1536),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kb_prospect_triggers_entry_id ON public.kb_prospect_triggers(entry_id);

-- Vector index is NOT created here — build it after split-triggers.js populates
-- the table (~6,000+ rows). Building an ivfflat index on an empty table is wasteful.
-- split-triggers.js will print the exact SQL to run after it completes.

-- ── STEP 2: Create search_kb_by_trigger RPC ───────────────────────────────────
-- Searches individual trigger rows (crisp per-phrase embeddings), picks the
-- best-matching trigger per technique via DISTINCT ON, returns top N techniques
-- ordered by similarity. Also returns matched_trigger for logging — so Railway
-- logs show exactly which trigger phrase caused a card to fire.

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
  RETURN QUERY
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
    FROM (
      -- Inner query: for each technique (DISTINCT ON e.id), pick the trigger row
      -- with the highest similarity (lowest distance) to the query.
      -- ORDER BY must start with the DISTINCT ON column (e.id), then distance ASC
      -- so Postgres picks the closest trigger for each technique.
      SELECT DISTINCT ON (e.id)
        e.id,
        e.technique_name,
        e.situation,
        e.exact_script,
        e.why_it_works,
        e.call_stage,
        e.quality_score,
        (1 - (t.embedding <=> query_embedding))::float AS similarity,
        t.trigger_text AS matched_trigger
      FROM public.kb_prospect_triggers t
      JOIN public.kb_signal_card_entries e ON t.entry_id = e.id
      WHERE
        t.embedding IS NOT NULL
        AND e.quality_score IN ('high', 'medium')
        AND e.trigger_speaker = 'prospect'
        AND (1 - (t.embedding <=> query_embedding)) >= similarity_threshold
      ORDER BY e.id, (t.embedding <=> query_embedding) ASC
    ) best
    -- Outer query: rank techniques by their best trigger similarity, take top N
    ORDER BY best.similarity DESC
    LIMIT match_count;
END;
$$;

-- ── DONE ──────────────────────────────────────────────────────────────────────
-- After running this migration:
--   1. node knowledge-base/split-triggers.js    ← backfill trigger rows
--   2. node knowledge-base/calibrate.js         ← verify scores are now 0.72+
--   3. git push                                 ← deploy knowledge-search.ts changes
--   4. Run the ivfflat index SQL printed by split-triggers.js
-- ─────────────────────────────────────────────────────────────────────────────
