-- 内测2-#4 修正:老板确认「填有效邀请码也是 3 个月」(与不填一样,不叠加)。
-- 回退上一版的 6 个月路径:所有新用户一律 L2 黄金 3 个月。
-- 保留:只把「有效」邀请码(匹配到已存在用户 referral_code)落库,避免给无效码
-- 算推荐;推荐人奖励仍由 grant_referral_reward 触发。

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_ref_code  text := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'referred_by_code', '')), '');
  v_valid_ref boolean := false;
BEGIN
  IF v_ref_code IS NOT NULL THEN
    v_ref_code := upper(v_ref_code);
    SELECT EXISTS(
      SELECT 1 FROM public.users WHERE upper(referral_code) = v_ref_code
    ) INTO v_valid_ref;
  END IF;

  INSERT INTO public.users (
    id, name, email, phone, role,
    referral_code, referred_by_code,
    membership_level, membership_expires_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', '用户'),
    NEW.email,
    COALESCE(NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''), NEW.phone),
    'user',
    public.generate_referral_code(),
    CASE WHEN v_valid_ref THEN v_ref_code ELSE NULL END,
    'L2',
    now() + interval '3 months'   -- 一律 3 个月(填不填邀请码都一样)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
