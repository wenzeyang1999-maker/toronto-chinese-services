-- referral_rewards_trigger.sql
-- Automatically upgrades a referrer's membership when their referral count
-- crosses a reward threshold.
--
-- Thresholds (customise as needed):
--   3 referrals  → L2 (gold)     30 days
--   10 referrals → L3 (platinum) 30 days
--
-- The trigger fires AFTER a new user row is inserted with a non-null
-- referred_by_code so it runs once per successful referral sign-up.
-- Re-running is safe (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.grant_referral_reward()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id   UUID;
  v_referral_count INT;
  v_new_level     TEXT;
  v_days          INT;
BEGIN
  -- Only process rows that have a referral code
  IF NEW.referred_by_code IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the referrer
  SELECT id INTO v_referrer_id
    FROM public.users
   WHERE referral_code = NEW.referred_by_code
   LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count total successful referrals for this referrer
  SELECT COUNT(*)::INT INTO v_referral_count
    FROM public.users
   WHERE referred_by_code = NEW.referred_by_code;

  -- Determine reward tier
  IF v_referral_count >= 10 THEN
    v_new_level := 'L3';
    v_days      := 30;
  ELSIF v_referral_count >= 3 THEN
    v_new_level := 'L2';
    v_days      := 30;
  ELSE
    RETURN NEW; -- below threshold, no reward yet
  END IF;

  -- Only upgrade (never downgrade) and only extend if already at this level
  UPDATE public.users
     SET membership_level      = v_new_level,
         membership_expires_at = GREATEST(
           COALESCE(membership_expires_at, NOW()),
           NOW()
         ) + (v_days || ' days')::INTERVAL
   WHERE id = v_referrer_id
     AND (
       membership_level IS DISTINCT FROM v_new_level
       OR membership_expires_at IS NULL
       OR membership_expires_at < NOW() + (v_days || ' days')::INTERVAL
     );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS referral_reward_trg ON public.users;
CREATE TRIGGER referral_reward_trg
  AFTER INSERT ON public.users
  FOR EACH ROW
  WHEN (NEW.referred_by_code IS NOT NULL)
  EXECUTE FUNCTION public.grant_referral_reward();
