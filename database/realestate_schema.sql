-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Real Estate Module Schema
-- Safe to run multiple times (IF NOT EXISTS guards throughout).
-- Requires: users table already exists.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: properties
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS properties (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  poster_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Listing type
  listing_type    VARCHAR(10)   NOT NULL DEFAULT 'rent',

  -- Property info
  title           VARCHAR(200)  NOT NULL,
  property_type   VARCHAR(20)   NOT NULL DEFAULT 'apartment',
  bedrooms        SMALLINT,                          -- NULL = studio / not specified
  bathrooms       NUMERIC(3,1),
  description     TEXT          NOT NULL,

  -- Price
  price           NUMERIC(12,2),
  price_type      VARCHAR(20)   NOT NULL DEFAULT 'monthly',

  -- Features
  pet_friendly        BOOLEAN   DEFAULT false,
  parking             BOOLEAN   DEFAULT false,
  utilities_included  BOOLEAN   DEFAULT false,

  -- Images (up to 6)
  images          TEXT[]        DEFAULT '{}',

  -- Location
  area            TEXT[],
  city            VARCHAR(100)  DEFAULT 'Toronto',
  address         VARCHAR(300),                      -- general address, no unit number needed

  -- Availability
  available_date  DATE,

  -- Contact
  contact_name    VARCHAR(100)  NOT NULL,
  contact_phone   VARCHAR(30)   NOT NULL,
  contact_wechat  VARCHAR(100),

  -- Status
  is_active       BOOLEAN       NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT properties_listing_type_check CHECK (
    listing_type IN ('rent', 'sale', 'shared')
  ),
  CONSTRAINT properties_property_type_check CHECK (
    property_type IN ('apartment','house','townhouse','condo','basement','room','other')
  ),
  CONSTRAINT properties_price_type_check CHECK (
    price_type IN ('monthly','total','negotiable')
  )
);


-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_properties_poster_id    ON properties (poster_id);
CREATE INDEX IF NOT EXISTS idx_properties_listing_type ON properties (listing_type);
CREATE INDEX IF NOT EXISTS idx_properties_is_active    ON properties (is_active);
CREATE INDEX IF NOT EXISTS idx_properties_created_at   ON properties (created_at DESC);


-- ─── Auto-update updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_properties_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_updated_at ON properties;
CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_properties_updated_at();


-- ─── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Anyone can read active listings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'properties' AND policyname = 'anyone can read active properties'
  ) THEN
    CREATE POLICY "anyone can read active properties"
      ON properties FOR SELECT
      USING (is_active = true);
  END IF;
END $$;

-- Poster can read their own listings (including inactive)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'properties' AND policyname = 'poster can read own properties'
  ) THEN
    CREATE POLICY "poster can read own properties"
      ON properties FOR SELECT
      USING (poster_id = auth.uid());
  END IF;
END $$;

-- Authenticated users can insert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'properties' AND policyname = 'authenticated users can post properties'
  ) THEN
    CREATE POLICY "authenticated users can post properties"
      ON properties FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL AND poster_id = auth.uid());
  END IF;
END $$;

-- Poster can update their own listings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'properties' AND policyname = 'poster can update own properties'
  ) THEN
    CREATE POLICY "poster can update own properties"
      ON properties FOR UPDATE
      USING (poster_id = auth.uid());
  END IF;
END $$;

-- Poster can delete their own listings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'properties' AND policyname = 'poster can delete own properties'
  ) THEN
    CREATE POLICY "poster can delete own properties"
      ON properties FOR DELETE
      USING (poster_id = auth.uid());
  END IF;
END $$;
