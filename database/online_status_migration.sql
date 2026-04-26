-- ── Provider Online Status ────────────────────────────────────────────────────
-- Adds is_online flag to users table so providers can toggle availability.
-- Run once in the Supabase SQL editor.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false;

-- Automatically reset to offline if provider hasn't updated in 24 h
-- (optional scheduled job — skip if not using pg_cron)
-- SELECT cron.schedule('reset-offline', '0 * * * *', $$
--   UPDATE public.users SET is_online = false
--   WHERE is_online = true AND last_seen_at < NOW() - INTERVAL '24 hours'
-- $$);
