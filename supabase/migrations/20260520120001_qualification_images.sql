-- ─── Qualification & Equipment photos ───────────────────────────────────────
-- Providers can upload photos of their licenses, certificates, fleet, tools,
-- etc. Shown under a "资质与设备" section on their public provider page so
-- clients can verify them visually.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS qualification_images TEXT[] NOT NULL DEFAULT '{}';
