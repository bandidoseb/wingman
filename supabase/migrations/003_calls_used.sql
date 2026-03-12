-- Migration 003: Add calls_used counter to profiles
-- Run this in your Supabase SQL editor:
-- Dashboard → SQL Editor → paste this → Run

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS calls_used INTEGER DEFAULT 0;
