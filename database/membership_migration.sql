-- ─── Membership Migration ────────────────────────────────────────────────────
-- Adds membership_level (already exists on most installs) and membership_expires_at.
-- Admin grants L2/L3 in 30-day blocks; frontend treats expired L2/L3 as L1.
-- Safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_level      TEXT        NOT NULL DEFAULT 'L1';
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_membership_level_check
    CHECK (membership_level IN ('L1', 'L2', 'L3'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_membership_expires
  ON users (membership_expires_at)
  WHERE membership_expires_at IS NOT NULL;
