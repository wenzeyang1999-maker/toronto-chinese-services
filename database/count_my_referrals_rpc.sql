-- ── count_my_referrals() ──────────────────────────────────────────────────────
-- Returns the number of users who registered with the authenticated user's
-- referral code. SECURITY DEFINER prevents the caller from brute-forcing
-- arbitrary codes via direct table queries.
--
-- Run once in the Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.count_my_referrals()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT
  FROM public.users
  WHERE referred_by_code = (
    SELECT referral_code FROM public.users WHERE id = auth.uid()
  )
$$;

GRANT EXECUTE ON FUNCTION public.count_my_referrals() TO authenticated;
