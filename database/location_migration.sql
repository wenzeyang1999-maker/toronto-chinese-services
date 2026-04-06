-- ─── Location Migration ───────────────────────────────────────────────────────
-- Adds address / lat / lng to listing tables so merchants can show their location.
-- services & jobs already have lat/lng — just need address text.
-- secondhand needs all three.
-- Safe to run multiple times (IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE services   ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE jobs       ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE secondhand ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE secondhand ADD COLUMN IF NOT EXISTS lat     DOUBLE PRECISION;
ALTER TABLE secondhand ADD COLUMN IF NOT EXISTS lng     DOUBLE PRECISION;
