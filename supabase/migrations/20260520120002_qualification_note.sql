-- ─── Qualification note (free-text) ─────────────────────────────────────────
-- Merges the old structured certifications list into the 资质与设备 section:
-- one free-text description + the qualification_images gallery.
-- The legacy `certifications` JSONB column is kept (unused) for safety.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS qualification_note TEXT;
