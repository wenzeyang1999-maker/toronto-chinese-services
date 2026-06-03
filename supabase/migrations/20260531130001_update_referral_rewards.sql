-- Update referral reward logic to new rules:
--   Old: 3 referrals → L2 (30d), 10 referrals → L3 (30d)
--   New: every 10 referrals → L2 +30 days (cumulative, no L3 auto-upgrade)
--
-- L3 users (admin-granted) are never downgraded.
-- Existing L2 time is extended, not reset.

CREATE OR REPLACE FUNCTION public.grant_referral_reward()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id    UUID;
  v_referral_count INT;
BEGIN
  IF NEW.referred_by_code IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_referrer_id
    FROM public.users
   WHERE referral_code = NEW.referred_by_code
   LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::INT INTO v_referral_count
    FROM public.users
   WHERE referred_by_code = NEW.referred_by_code;

  -- Grant +30 days of L2 at every 10th referral (10, 20, 30 …)
  IF v_referral_count % 10 = 0 THEN
    UPDATE public.users
       SET membership_level      = CASE
                                     WHEN membership_level = 'L3' THEN 'L3'
                                     ELSE 'L2'
                                   END,
           membership_expires_at = GREATEST(
             COALESCE(membership_expires_at, NOW()),
             NOW()
           ) + INTERVAL '30 days'
     WHERE id = v_referrer_id;
  END IF;

  RETURN NEW;
END;
$$;
