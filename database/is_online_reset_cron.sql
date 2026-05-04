-- ─── is_online Auto-Reset via pg_cron ────────────────────────────────────────
-- Resets is_online = false for users whose last_seen_at is older than 24 hours.
-- Prevents "ghost online" state if the server crashes while a user is active.
--
-- Requires the pg_cron extension (enabled by default on Supabase projects).
-- Run once; the cron job persists in the DB.

-- Enable pg_cron if not already active
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any existing version of this job (idempotent)
SELECT cron.unschedule('reset-offline-users')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'reset-offline-users'
);

-- Schedule: runs every hour at :00
SELECT cron.schedule(
  'reset-offline-users',
  '0 * * * *',
  $$
    UPDATE public.users
    SET    is_online = false
    WHERE  is_online = true
      AND  last_seen_at < NOW() - INTERVAL '24 hours';
  $$
);
