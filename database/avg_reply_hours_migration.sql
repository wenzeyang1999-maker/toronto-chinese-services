-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Avg Reply Hours Migration
-- Adds avg_reply_hours to users table.
-- Updated automatically when a provider replies to a conversation.
-- Safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS avg_reply_hours FLOAT;
