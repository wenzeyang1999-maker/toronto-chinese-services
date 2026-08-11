-- 内测2-#4:邀请码新客奖励。
-- 现状:所有新用户自动送 L2 黄金 3 个月。改为:注册时填了「有效」邀请码
-- (匹配到某个已存在用户的 referral_code)→ 额外再 +3 个月,共 6 个月;
-- 没填 / 填了无效码 → 仍是 3 个月。适用于所有注册方式(邮箱/手机/Google,
-- 只要 metadata 带 referred_by_code)。推荐人奖励仍由 grant_referral_reward 触发。

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_ref_code  text := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'referred_by_code', '')), '');
  v_valid_ref boolean := false;
  v_months    int := 3;
BEGIN
  IF v_ref_code IS NOT NULL THEN
    v_ref_code := upper(v_ref_code);
    SELECT EXISTS(
      SELECT 1 FROM public.users WHERE upper(referral_code) = v_ref_code
    ) INTO v_valid_ref;
    IF v_valid_ref THEN
      v_months := 6;   -- 有效邀请码:3 个月基础 + 3 个月奖励
    END IF;
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
    -- 只有「有效」邀请码才落库(否则记 NULL,避免给无效码算推荐)
    CASE WHEN v_valid_ref THEN v_ref_code ELSE NULL END,
    'L2',
    now() + make_interval(months => v_months)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
