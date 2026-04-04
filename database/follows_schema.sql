-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Follows Schema
-- One row per (follower, provider) pair.
-- Safe to run multiple times (IF NOT EXISTS guards throughout).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS follows (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (follower_id, provider_id),
  -- Prevent self-follow
  CONSTRAINT follows_no_self CHECK (follower_id != provider_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_provider ON follows (provider_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Anyone can read follower counts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'follows' AND policyname = 'anyone can read follows'
  ) THEN
    CREATE POLICY "anyone can read follows"
      ON follows FOR SELECT USING (true);
  END IF;
END $$;

-- Authenticated users can follow
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'follows' AND policyname = 'users can insert own follow'
  ) THEN
    CREATE POLICY "users can insert own follow"
      ON follows FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL AND follower_id = auth.uid());
  END IF;
END $$;

-- Users can unfollow (delete their own row)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'follows' AND policyname = 'users can delete own follow'
  ) THEN
    CREATE POLICY "users can delete own follow"
      ON follows FOR DELETE
      USING (follower_id = auth.uid());
  END IF;
END $$;
