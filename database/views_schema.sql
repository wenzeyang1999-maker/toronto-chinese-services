-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Views (Page View Counts) Schema
-- Records each unique view of a listing detail page.
-- Dedup handled on frontend (localStorage) to avoid counting refreshes.
-- Safe to run multiple times (IF NOT EXISTS guards throughout).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS views (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(20) NOT NULL,
  target_id   UUID        NOT NULL,
  viewer_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT views_target_type_check CHECK (
    target_type IN ('service', 'job', 'property', 'secondhand', 'event')
  )
);

CREATE INDEX IF NOT EXISTS idx_views_target ON views (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_views_viewer ON views (viewer_id);

ALTER TABLE views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a view (including anonymous visitors)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'views' AND policyname = 'anyone can insert view'
  ) THEN
    CREATE POLICY "anyone can insert view"
      ON views FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Anyone can read view counts (for display)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'views' AND policyname = 'anyone can read views'
  ) THEN
    CREATE POLICY "anyone can read views"
      ON views FOR SELECT
      USING (true);
  END IF;
END $$;
