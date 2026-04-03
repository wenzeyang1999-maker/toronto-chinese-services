-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Post Status Migration
-- Adds is_filled column to jobs and properties tables.
-- is_filled = true means the poster has marked the post as done
--   jobs:       recruited / position filled
--   properties: rented / sold
-- Safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE jobs       ADD COLUMN IF NOT EXISTS is_filled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_filled BOOLEAN NOT NULL DEFAULT false;
