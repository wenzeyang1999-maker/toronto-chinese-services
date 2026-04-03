-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Secondhand Marketplace Schema
-- Safe to run multiple times (IF NOT EXISTS guards throughout).
-- Requires: users table already exists.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: secondhand
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS secondhand (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  seller_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Item info
  title           VARCHAR(200)  NOT NULL,
  category        VARCHAR(50)   NOT NULL DEFAULT 'other',
  condition       VARCHAR(20)   NOT NULL DEFAULT 'good',
  description     TEXT          NOT NULL,

  -- Price
  price           NUMERIC(10,2),
  is_free         BOOLEAN       NOT NULL DEFAULT false,

  -- Images (up to 4)
  images          TEXT[]        DEFAULT '{}',

  -- Location
  area            TEXT[],
  city            VARCHAR(100)  DEFAULT 'Toronto',

  -- Contact
  contact_name    VARCHAR(100)  NOT NULL,
  contact_phone   VARCHAR(30)   NOT NULL,
  contact_wechat  VARCHAR(100),

  -- Status
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  is_sold         BOOLEAN       NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT secondhand_category_check CHECK (
    category IN ('electronics','furniture','clothing','baby','books','vehicle','sports','other')
  ),
  CONSTRAINT secondhand_condition_check CHECK (
    condition IN ('new','like_new','good','fair')
  )
);


-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_secondhand_seller_id  ON secondhand (seller_id);
CREATE INDEX IF NOT EXISTS idx_secondhand_category   ON secondhand (category);
CREATE INDEX IF NOT EXISTS idx_secondhand_is_active  ON secondhand (is_active);
CREATE INDEX IF NOT EXISTS idx_secondhand_is_sold    ON secondhand (is_sold);
CREATE INDEX IF NOT EXISTS idx_secondhand_created_at ON secondhand (created_at DESC);


-- ─── Auto-update updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_secondhand_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_secondhand_updated_at ON secondhand;
CREATE TRIGGER trg_secondhand_updated_at
  BEFORE UPDATE ON secondhand
  FOR EACH ROW EXECUTE FUNCTION update_secondhand_updated_at();


-- ─── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE secondhand ENABLE ROW LEVEL SECURITY;

-- Anyone can read active listings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'secondhand' AND policyname = 'anyone can read active listings'
  ) THEN
    CREATE POLICY "anyone can read active listings"
      ON secondhand FOR SELECT
      USING (is_active = true);
  END IF;
END $$;

-- Seller can read their own listings (including inactive)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'secondhand' AND policyname = 'seller can read own listings'
  ) THEN
    CREATE POLICY "seller can read own listings"
      ON secondhand FOR SELECT
      USING (seller_id = auth.uid());
  END IF;
END $$;

-- Authenticated users can insert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'secondhand' AND policyname = 'authenticated users can post listings'
  ) THEN
    CREATE POLICY "authenticated users can post listings"
      ON secondhand FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL AND seller_id = auth.uid());
  END IF;
END $$;

-- Seller can update their own listings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'secondhand' AND policyname = 'seller can update own listings'
  ) THEN
    CREATE POLICY "seller can update own listings"
      ON secondhand FOR UPDATE
      USING (seller_id = auth.uid());
  END IF;
END $$;

-- Seller can delete their own listings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'secondhand' AND policyname = 'seller can delete own listings'
  ) THEN
    CREATE POLICY "seller can delete own listings"
      ON secondhand FOR DELETE
      USING (seller_id = auth.uid());
  END IF;
END $$;
