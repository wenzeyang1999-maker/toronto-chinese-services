-- Capture the customer's location on inquiries so provider matching can rank
-- nearby providers first (avoid emailing a North York request to Scarborough).
-- Soft ranking, not a hard filter — providers without coords still get a chance.

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;
