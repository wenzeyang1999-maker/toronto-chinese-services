-- ─── Cleanup: remove all demo seed data ─────────────────────────────────────
-- One-shot script. NOT a migration (don't put in supabase/migrations/) so it
-- doesn't auto-apply. Run manually in Supabase SQL editor when you're ready
-- to take the demo data offline.
--
-- All demo users were created with @tcs-demo.local emails by
-- supabase/migrations/20260518120006_demo_service_requests.sql, so we use
-- that as the cleanup filter. Safe to run multiple times.

BEGIN;

-- 1. How many demo records exist? (informational — adjust to verify)
SELECT
  (SELECT COUNT(*) FROM users WHERE email LIKE '%@tcs-demo.local') AS demo_users,
  (SELECT COUNT(*) FROM service_requests
    WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@tcs-demo.local')) AS demo_requests;

-- 2. Delete the demo service_requests first (FK to users)
DELETE FROM public.service_requests
WHERE user_id IN (
  SELECT id FROM public.users WHERE email LIKE '%@tcs-demo.local'
);

-- 3. Delete the demo users themselves
DELETE FROM public.users
WHERE email LIKE '%@tcs-demo.local';

-- 4. Verify nothing remains
SELECT
  (SELECT COUNT(*) FROM users WHERE email LIKE '%@tcs-demo.local') AS demo_users_left,
  (SELECT COUNT(*) FROM service_requests
    WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@tcs-demo.local')) AS demo_requests_left;

COMMIT;

-- If anything above looked wrong, ROLLBACK; instead of COMMIT.
