-- ─── SECURITY (email 收口, part 2/2): drop email exposure ────────────────────
-- Two remaining email read paths:
--   1. base table: authenticated held SELECT(email) → any logged-in user could
--      `select email from users` and scrape EVERY user's email (customers too).
--   2. public_profiles view: exposed provider/admin email (anon-readable).
-- The frontend now reads email only via the authorized get_contact /
-- admin_get_user_emails RPCs (part 1), so both direct paths can be closed.

-- 1) Recreate the view WITHOUT the email column (everything else identical).
--    DROP+CREATE because CREATE OR REPLACE VIEW cannot remove a trailing column.
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
  SELECT id,
         name,
         avatar_url,
         bio,
         created_at,
         last_seen_at,
         role,
         membership_level,
         business_verified,
         avg_reply_hours,
         is_email_verified,
         phone_verified,
         social_links
    FROM public.users;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2) Revoke the email column from every client role. service_role keeps it, and
--    the SECURITY DEFINER RPCs (get_contact / admin_get_user_emails) still read
--    it because they run as the function owner, not the caller.
REVOKE SELECT (email) ON public.users FROM PUBLIC;
REVOKE SELECT (email) ON public.users FROM anon;
REVOKE SELECT (email) ON public.users FROM authenticated;
