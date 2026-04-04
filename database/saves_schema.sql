-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Saves (Favourites) Schema
-- One row per (user, target_type, target_id).
-- target_type: 'service' | 'job' | 'property' | 'secondhand' | 'event'
-- Safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saves (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(20) NOT NULL,
  target_id   UUID        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, target_type, target_id),

  CONSTRAINT saves_target_type_check CHECK (
    target_type IN ('service', 'job', 'property', 'secondhand', 'event')
  )
);

CREATE INDEX IF NOT EXISTS idx_saves_user_id     ON saves (user_id);
CREATE INDEX IF NOT EXISTS idx_saves_target      ON saves (target_type, target_id);

ALTER TABLE saves ENABLE ROW LEVEL SECURITY;

-- Users can read their own saves
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saves' AND policyname = 'users can read own saves') THEN
    CREATE POLICY "users can read own saves" ON saves FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- Users can insert their own saves
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saves' AND policyname = 'users can insert own saves') THEN
    CREATE POLICY "users can insert own saves" ON saves FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
  END IF;
END $$;

-- Users can delete their own saves
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saves' AND policyname = 'users can delete own saves') THEN
    CREATE POLICY "users can delete own saves" ON saves FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;
