-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Promoted Listings Migration
-- Adds is_promoted column to all 5 listing tables.
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE services    ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE jobs        ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE properties  ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE secondhand  ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE events      ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN NOT NULL DEFAULT false;

-- Index: fast lookup of promoted rows per table
CREATE INDEX IF NOT EXISTS idx_services_promoted   ON services   (is_promoted) WHERE is_promoted = true;
CREATE INDEX IF NOT EXISTS idx_jobs_promoted       ON jobs       (is_promoted) WHERE is_promoted = true;
CREATE INDEX IF NOT EXISTS idx_properties_promoted ON properties (is_promoted) WHERE is_promoted = true;
CREATE INDEX IF NOT EXISTS idx_secondhand_promoted ON secondhand (is_promoted) WHERE is_promoted = true;
CREATE INDEX IF NOT EXISTS idx_events_promoted     ON events     (is_promoted) WHERE is_promoted = true;
