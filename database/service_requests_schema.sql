-- ── service_requests ──────────────────────────────────────────────────────────
-- Clients post what service they need; providers browse this board.

CREATE TABLE IF NOT EXISTS service_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'other',
  area        TEXT,
  city        TEXT DEFAULT 'Toronto',
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  budget      TEXT,                          -- free text: "面议", "$50-100/时"
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  status      TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-close expired requests
CREATE OR REPLACE FUNCTION close_expired_requests()
RETURNS void LANGUAGE sql AS $$
  UPDATE service_requests
  SET status = 'closed', updated_at = NOW()
  WHERE status = 'open' AND expires_at < NOW();
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS service_requests_user_id_idx    ON service_requests(user_id);
CREATE INDEX IF NOT EXISTS service_requests_status_idx     ON service_requests(status);
CREATE INDEX IF NOT EXISTS service_requests_category_idx   ON service_requests(category);
CREATE INDEX IF NOT EXISTS service_requests_expires_at_idx ON service_requests(expires_at);

-- RLS
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read open requests"
  ON service_requests FOR SELECT
  USING (status = 'open');

CREATE POLICY "Owner can insert"
  ON service_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update/close"
  ON service_requests FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can delete"
  ON service_requests FOR DELETE
  USING (auth.uid() = user_id);
