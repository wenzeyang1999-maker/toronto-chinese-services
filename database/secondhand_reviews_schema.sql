-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Secondhand Reviews Schema
-- Buyer ratings + comments on secondhand items.
-- Safe to run multiple times (IF NOT EXISTS / DROP-CREATE for policies).
-- Requires: secondhand and users tables already exist.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: secondhand_reviews
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS secondhand_reviews (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  item_id      UUID         NOT NULL REFERENCES secondhand(id) ON DELETE CASCADE,
  reviewer_id  UUID         NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  seller_id    UUID                  REFERENCES users(id)      ON DELETE SET NULL,

  rating       INT          NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,

  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- One review per (item, reviewer) pair
  UNIQUE (item_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS secondhand_reviews_item_idx     ON secondhand_reviews(item_id);
CREATE INDEX IF NOT EXISTS secondhand_reviews_seller_idx   ON secondhand_reviews(seller_id);
CREATE INDEX IF NOT EXISTS secondhand_reviews_reviewer_idx ON secondhand_reviews(reviewer_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE secondhand_reviews ENABLE ROW LEVEL SECURITY;

-- Public read
DROP POLICY IF EXISTS "secondhand_reviews_select" ON secondhand_reviews;
CREATE POLICY "secondhand_reviews_select"
  ON secondhand_reviews
  FOR SELECT
  USING (true);

-- Authenticated users can insert their own review
DROP POLICY IF EXISTS "secondhand_reviews_insert_own" ON secondhand_reviews;
CREATE POLICY "secondhand_reviews_insert_own"
  ON secondhand_reviews
  FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

-- Reviewer can update / delete their own review
DROP POLICY IF EXISTS "secondhand_reviews_update_own" ON secondhand_reviews;
CREATE POLICY "secondhand_reviews_update_own"
  ON secondhand_reviews
  FOR UPDATE
  USING (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "secondhand_reviews_delete_own" ON secondhand_reviews;
CREATE POLICY "secondhand_reviews_delete_own"
  ON secondhand_reviews
  FOR DELETE
  USING (auth.uid() = reviewer_id);
