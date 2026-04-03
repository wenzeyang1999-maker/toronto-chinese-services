-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Review Interactions Schema
-- Adds: review_votes (helpful/not helpful) + review_reports (flag for admin)
-- Safe to run multiple times (IF NOT EXISTS guards throughout).
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: review_votes
-- One row per (user, review) — UNIQUE prevents double-voting.
-- Toggling off = DELETE the row. Changing vote = UPDATE via upsert.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID        NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  is_helpful  BOOLEAN     NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_votes_review_id ON review_votes (review_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_user_id   ON review_votes (user_id);

ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed to show counts to unauthenticated visitors)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_votes' AND policyname = 'anyone can read review votes'
  ) THEN
    CREATE POLICY "anyone can read review votes"
      ON review_votes FOR SELECT USING (true);
  END IF;
END $$;

-- Authenticated users can insert their own vote
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_votes' AND policyname = 'users can insert own vote'
  ) THEN
    CREATE POLICY "users can insert own vote"
      ON review_votes FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
  END IF;
END $$;

-- Users can update their own vote (for upsert)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_votes' AND policyname = 'users can update own vote'
  ) THEN
    CREATE POLICY "users can update own vote"
      ON review_votes FOR UPDATE
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Users can delete (toggle off) their own vote
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_votes' AND policyname = 'users can delete own vote'
  ) THEN
    CREATE POLICY "users can delete own vote"
      ON review_votes FOR DELETE
      USING (user_id = auth.uid());
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: review_reports
-- One report per (user, review) — user can only flag a review once.
-- Admin views pending reports and sets status to dismissed / removed.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID        NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  reporter_id UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  reason      VARCHAR(50) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (review_id, reporter_id),

  CONSTRAINT review_reports_reason_check CHECK (
    reason IN ('irrelevant', 'malicious', 'fake', 'spam', 'other')
  ),
  CONSTRAINT review_reports_status_check CHECK (
    status IN ('pending', 'dismissed', 'removed')
  )
);

CREATE INDEX IF NOT EXISTS idx_review_reports_review_id   ON review_reports (review_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_reporter_id ON review_reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_status      ON review_reports (status);

ALTER TABLE review_reports ENABLE ROW LEVEL SECURITY;

-- Users can read their own reports (to know they already reported)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_reports' AND policyname = 'users can read own reports'
  ) THEN
    CREATE POLICY "users can read own reports"
      ON review_reports FOR SELECT
      USING (reporter_id = auth.uid());
  END IF;
END $$;

-- Authenticated users can insert a report
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_reports' AND policyname = 'users can insert report'
  ) THEN
    CREATE POLICY "users can insert report"
      ON review_reports FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL AND reporter_id = auth.uid());
  END IF;
END $$;

-- Admins can read and manage all reports
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_reports' AND policyname = 'admins can manage reports'
  ) THEN
    CREATE POLICY "admins can manage reports"
      ON review_reports FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;
