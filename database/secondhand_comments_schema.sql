-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Secondhand Comments Schema
-- Public Q&A / discussion under each secondhand listing.
-- Safe to run multiple times.
-- Requires: secondhand and users tables already exist.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS secondhand_comments (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  item_id     UUID         NOT NULL REFERENCES secondhand(id) ON DELETE CASCADE,
  author_id   UUID         NOT NULL REFERENCES users(id)      ON DELETE CASCADE,

  content     TEXT         NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),

  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS secondhand_comments_item_idx    ON secondhand_comments(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS secondhand_comments_author_idx  ON secondhand_comments(author_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE secondhand_comments ENABLE ROW LEVEL SECURITY;

-- Public read
DROP POLICY IF EXISTS "secondhand_comments_select" ON secondhand_comments;
CREATE POLICY "secondhand_comments_select"
  ON secondhand_comments
  FOR SELECT
  USING (true);

-- Authenticated users can post their own comment
DROP POLICY IF EXISTS "secondhand_comments_insert_own" ON secondhand_comments;
CREATE POLICY "secondhand_comments_insert_own"
  ON secondhand_comments
  FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Author can delete their own comment
DROP POLICY IF EXISTS "secondhand_comments_delete_own" ON secondhand_comments;
CREATE POLICY "secondhand_comments_delete_own"
  ON secondhand_comments
  FOR DELETE
  USING (auth.uid() = author_id);
