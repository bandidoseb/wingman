-- 011_outcome_source.sql — capture calls.outcome_source in version control.
--
-- 2026-07-26. This column was applied to Supabase BY HAND on 2026-07-24 alongside the
-- post-call AI outcome auto-detect. This file exists so a rebuilt environment isn't
-- silently broken — the exact failure mode of Known Issue #50 (profiles.sales_dna and
-- set_sales_dna_syntax_if_unsure were hand-run and never captured, so a fresh database
-- 500s on every Sales DNA write with no clue why).
--
-- WHAT IT DOES: records who set a call's outcome.
--   'manual' → the rep picked it (dashboard picker or the legacy HUD outcome card)
--   'auto'   → the post-call Sonnet job inferred it from the transcript
--   NULL     → no outcome set yet, or a row written before this column existed
--
-- Why it matters beyond bookkeeping: every stat surface treats 'auto' as UNCONFIRMED
-- (see confirmedOutcome() in src/lib/wingman/outcome-stats.ts), so a guessed outcome
-- never silently inflates the rep's close rate. Dropping this column would make every
-- AI guess count as fact.
--
-- SAFETY: additive, idempotent, non-destructive. IF NOT EXISTS means re-running it on
-- the database that already has the hand-run column is a no-op. It adds one nullable
-- column, deletes nothing, and alters no existing column. Existing rows get NULL,
-- which every read path already handles (see the `?? null` / `!== "auto"` guards).

ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS outcome_source text;

-- Only the two known writers should ever appear here. A CHECK keeps a future typo
-- ('Manual', 'ai') from quietly creating a third class that confirmedOutcome() would
-- mis-count as a confirmed human pick.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calls_outcome_source_check'
  ) THEN
    ALTER TABLE public.calls
      ADD CONSTRAINT calls_outcome_source_check
      CHECK (outcome_source IS NULL OR outcome_source IN ('manual', 'auto'));
  END IF;
END $$;
