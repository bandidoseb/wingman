-- Migration 004: Add extra_calls_remaining for top-off rollover calls
--
-- Extra calls are purchased one-time and carry over month to month
-- until fully used. Unlike calls_used (which resets monthly), this
-- column is only ever decremented (never reset by invoice.paid).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS extra_calls_remaining INTEGER NOT NULL DEFAULT 0;
