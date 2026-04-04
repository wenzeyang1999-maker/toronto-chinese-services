-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Bio Migration
-- Adds bio column to users table for personal/provider descriptions.
-- Safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
