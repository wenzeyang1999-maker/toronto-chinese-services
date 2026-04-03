-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Jobs Module Schema
-- Safe to run multiple times (IF NOT EXISTS guards throughout).
-- Requires: users table already exists.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: jobs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  poster_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Listing type: hiring (雇主找人) vs seeking (个人求职)
  listing_type    VARCHAR(10)   NOT NULL DEFAULT 'hiring',

  -- Job info
  title           VARCHAR(200)  NOT NULL,
  company_name    VARCHAR(200),                           -- optional; individual employers may leave blank
  category        VARCHAR(50)   NOT NULL DEFAULT 'other', -- see CHECK below
  job_type        VARCHAR(20)   NOT NULL DEFAULT 'fulltime',
  description     TEXT          NOT NULL,
  requirements    TEXT,                                   -- 任职要求 (optional)
  benefits        TEXT,                                   -- 福利待遇 (optional)

  -- Salary
  salary_min      NUMERIC(10,2),
  salary_max      NUMERIC(10,2),
  salary_type     VARCHAR(20)   NOT NULL DEFAULT 'negotiable',

  -- Location
  area            TEXT[],
  city            VARCHAR(100)  DEFAULT 'Toronto',
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,

  -- Contact (pre-filled from poster's profile, editable)
  contact_name    VARCHAR(100)  NOT NULL,
  contact_phone   VARCHAR(30)   NOT NULL,
  contact_wechat  VARCHAR(100),

  -- Status
  is_active       BOOLEAN       NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT jobs_listing_type_check CHECK (
    listing_type IN ('hiring', 'seeking')
  ),
  CONSTRAINT jobs_category_check CHECK (
    category IN ('food','retail','it','construction','cleaning','driver','education','accounting','other')
  ),
  CONSTRAINT jobs_job_type_check CHECK (
    job_type IN ('fulltime','parttime','casual','contract')
  ),
  CONSTRAINT jobs_salary_type_check CHECK (
    salary_type IN ('hourly','daily','monthly','negotiable')
  )
);


-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_poster_id  ON jobs (poster_id);
CREATE INDEX IF NOT EXISTS idx_jobs_category   ON jobs (category);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active  ON jobs (is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs (created_at DESC);


-- ─── Auto-update updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_jobs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON jobs;
CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_jobs_updated_at();


-- ─── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Anyone can read active jobs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'anyone can read active jobs'
  ) THEN
    CREATE POLICY "anyone can read active jobs"
      ON jobs FOR SELECT
      USING (is_active = true);
  END IF;
END $$;

-- Poster can read their own jobs (including inactive)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'poster can read own jobs'
  ) THEN
    CREATE POLICY "poster can read own jobs"
      ON jobs FOR SELECT
      USING (poster_id = auth.uid());
  END IF;
END $$;

-- Authenticated users can insert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'authenticated users can post jobs'
  ) THEN
    CREATE POLICY "authenticated users can post jobs"
      ON jobs FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL AND poster_id = auth.uid());
  END IF;
END $$;

-- Poster can update their own jobs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'poster can update own jobs'
  ) THEN
    CREATE POLICY "poster can update own jobs"
      ON jobs FOR UPDATE
      USING (poster_id = auth.uid());
  END IF;
END $$;

-- Poster can delete their own jobs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'poster can delete own jobs'
  ) THEN
    CREATE POLICY "poster can delete own jobs"
      ON jobs FOR DELETE
      USING (poster_id = auth.uid());
  END IF;
END $$;


-- ─── Migrations ───────────────────────────────────────────────────────────────
-- Convert area from VARCHAR to TEXT[] (run once if table was created before this change)
ALTER TABLE jobs ALTER COLUMN area TYPE TEXT[]
  USING CASE WHEN area IS NULL THEN NULL ELSE ARRAY[area::TEXT] END;

-- Add listing_type column (run once if table was created before this change)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS listing_type VARCHAR(10) NOT NULL DEFAULT 'hiring';
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_listing_type_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_listing_type_check CHECK (listing_type IN ('hiring', 'seeking'));

-- Add category_other column for custom "其他" category text
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS category_other VARCHAR(100);
