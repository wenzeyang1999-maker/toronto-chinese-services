-- credit_penalty stays a PUBLIC trust signal (shown on provider profiles), but
-- must not be scrapeable from the base users table alongside other columns.
-- Move it into public_profiles (the intended public surface) and revoke the base
-- column from clients. (Same column list as 20260706120010 + credit_penalty.)
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
         social_links,
         credit_penalty
    FROM public.users;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

REVOKE SELECT (credit_penalty) ON public.users FROM PUBLIC, anon, authenticated;
