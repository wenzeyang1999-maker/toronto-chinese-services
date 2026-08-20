-- 七:新入驻会员同意享受「黄金会员」权限,截止日暂定 2027-05-01。
-- 1) effective_member_level:启动期 L2 保底改为「仅在 2027-05-01 前有效」,之后自动
--    回落真实等级(L3 在有效期内保留,其余 L1)。到时无需手动改代码。
-- 2) handle_new_user:新用户 membership_level=L2,membership_expires_at=2027-05-01
--    (取代此前的 now()+3 个月);有效邀请码仍记录以给推荐人发奖励。

CREATE OR REPLACE FUNCTION public.effective_member_level(p_uid uuid)
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT CASE
    WHEN u.membership_level = 'L3'
     AND (u.membership_expires_at IS NULL OR u.membership_expires_at > now())
    THEN 'L3'
    -- 启动期黄金保底:仅在 2027-05-01 前;之后回落 L1(真实等级)
    WHEN now() < TIMESTAMPTZ '2027-05-01 00:00:00+00' THEN 'L2'
    ELSE 'L1'
  END
  FROM public.users u
  WHERE u.id = p_uid
$$;

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
    TIMESTAMPTZ '2027-05-01 00:00:00+00'   -- 黄金权限截止日
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
