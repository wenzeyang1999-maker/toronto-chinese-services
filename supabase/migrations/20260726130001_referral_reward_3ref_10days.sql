-- 推荐奖励改档：每满 3 个成功推荐 → L2 +10 天（累加，不重置）。
--   旧：每 10 个 → +30 天。新：每 3 个 → +10 天（启动期激励更有感）。
-- L3（后台授予）永不降级；已有到期时间在其基础上顺延。

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

  -- 每满 3 个成功推荐（3, 6, 9 …）给 +10 天 L2
  IF v_referral_count % 3 = 0 THEN
    UPDATE public.users
       SET membership_level      = CASE
                                     WHEN membership_level = 'L3' THEN 'L3'
                                     ELSE 'L2'
                                   END,
           membership_expires_at = GREATEST(
             COALESCE(membership_expires_at, NOW()),
             NOW()
           ) + INTERVAL '10 days'
     WHERE id = v_referrer_id;
  END IF;

  RETURN NEW;
END;
$$;
