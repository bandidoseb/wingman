-- Migration: 002_ai_model_preference
-- Run this in your Supabase SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_model_preference TEXT DEFAULT 'smart'
    CHECK (ai_model_preference IN ('smart', 'fast'));

COMMENT ON COLUMN profiles.ai_model_preference IS
  'smart = claude-sonnet-4-6 | fast = claude-haiku-4-5-20251001';
