-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Events Module Schema
-- Safe to run multiple times (IF NOT EXISTS guards throughout).
-- Requires: users table already exists.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: events
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  poster_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Event type
  event_type      VARCHAR(20)   NOT NULL DEFAULT 'other',

  -- Basic info
  title           VARCHAR(200)  NOT NULL,
  description     TEXT          NOT NULL,

  -- Date & Time
  event_date      DATE          NOT NULL,
  event_time      TIME,                              -- NULL = time TBD
  event_end_time  TIME,                              -- NULL = no end time

  -- Location
  location_name   VARCHAR(200),                     -- venue name, e.g. 多伦多市政厅
  address         VARCHAR(300),
  area            TEXT[],                            -- GTA area tags

  -- Price
  price           NUMERIC(10,2),                    -- NULL = free

  -- Capacity
  max_attendees   INTEGER,                           -- NULL = unlimited

  -- Images (up to 4)
  images          TEXT[]        DEFAULT '{}',

  -- Contact
  contact_name    VARCHAR(100)  NOT NULL,
  contact_phone   VARCHAR(30)   NOT NULL,
  contact_wechat  VARCHAR(100),

  -- Status
  is_active       BOOLEAN       NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT events_event_type_check CHECK (
    event_type IN ('party','exhibition','course','performance','sports','food','culture','other')
  )
);


-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_poster_id  ON events (poster_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events (event_type);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events (event_date);
CREATE INDEX IF NOT EXISTS idx_events_is_active  ON events (is_active);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events (created_at DESC);


-- ─── Auto-update updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_events_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_events_updated_at();


-- ─── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Anyone can read active events
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'anyone can read active events'
  ) THEN
    CREATE POLICY "anyone can read active events"
      ON events FOR SELECT
      USING (is_active = true);
  END IF;
END $$;

-- Poster can read their own events (including inactive)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'poster can read own events'
  ) THEN
    CREATE POLICY "poster can read own events"
      ON events FOR SELECT
      USING (poster_id = auth.uid());
  END IF;
END $$;

-- Authenticated users can insert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'authenticated users can post events'
  ) THEN
    CREATE POLICY "authenticated users can post events"
      ON events FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL AND poster_id = auth.uid());
  END IF;
END $$;

-- Poster can update their own events
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'poster can update own events'
  ) THEN
    CREATE POLICY "poster can update own events"
      ON events FOR UPDATE
      USING (poster_id = auth.uid());
  END IF;
END $$;

-- Poster can delete their own events
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'poster can delete own events'
  ) THEN
    CREATE POLICY "poster can delete own events"
      ON events FOR DELETE
      USING (poster_id = auth.uid());
  END IF;
END $$;
