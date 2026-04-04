-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Review Replies Schema
-- One reply per review per service provider (replier must own the service).
-- Safe to run multiple times (IF NOT EXISTS guards throughout).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS review_replies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID        NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  replier_id  UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One reply per review (provider replies once)
  UNIQUE (review_id, replier_id)
);

CREATE INDEX IF NOT EXISTS idx_review_replies_review_id  ON review_replies (review_id);
CREATE INDEX IF NOT EXISTS idx_review_replies_replier_id ON review_replies (replier_id);

ALTER TABLE review_replies ENABLE ROW LEVEL SECURITY;

-- Anyone can read replies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_replies' AND policyname = 'anyone can read review replies'
  ) THEN
    CREATE POLICY "anyone can read review replies"
      ON review_replies FOR SELECT USING (true);
  END IF;
END $$;

-- Authenticated users can insert their own reply
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_replies' AND policyname = 'users can insert own reply'
  ) THEN
    CREATE POLICY "users can insert own reply"
      ON review_replies FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL AND replier_id = auth.uid());
  END IF;
END $$;

-- Users can update their own reply
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_replies' AND policyname = 'users can update own reply'
  ) THEN
    CREATE POLICY "users can update own reply"
      ON review_replies FOR UPDATE
      USING (replier_id = auth.uid());
  END IF;
END $$;

-- Users can delete their own reply
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_replies' AND policyname = 'users can delete own reply'
  ) THEN
    CREATE POLICY "users can delete own reply"
      ON review_replies FOR DELETE
      USING (replier_id = auth.uid());
  END IF;
END $$;
