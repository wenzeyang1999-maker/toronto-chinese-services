-- Real-estate listings: precise location (map pin) + floor area, two of the
-- biggest decision factors when renting/buying that were previously missing.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS lat  double precision,
  ADD COLUMN IF NOT EXISTS lng  double precision,
  ADD COLUMN IF NOT EXISTS sqft integer;
