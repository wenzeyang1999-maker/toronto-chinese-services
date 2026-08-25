-- ─── 会员优惠改正:新会员送「3 个月黄金」(不是送到 2027-05-01)──────────────────
-- 本意:促销活动开放到 2027-05-01(在此之前注册的新人享免费黄金);每人拿到的是从
-- 注册日算起 3 个月黄金,到期回落真实等级。此前 handle_new_user 误写成固定 2027-05-01,
-- 且 effective_member_level 启动期一律保底黄金(导致 3 个月到期不生效)。这里全部改正。

-- ① effective_member_level:按每人自己的会员+到期日算,去掉「启动期一律保底黄金」。
CREATE OR REPLACE FUNCTION public.effective_member_level(p_uid uuid)
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT CASE
    WHEN u.membership_level = 'L3'
     AND (u.membership_expires_at IS NULL OR u.membership_expires_at > now()) THEN 'L3'
    WHEN u.membership_level = 'L2'
     AND u.membership_expires_at IS NOT NULL AND u.membership_expires_at > now() THEN 'L2'
    ELSE 'L1'
  END
  FROM public.users u
  WHERE u.id = p_uid
$$;

-- ② handle_new_user:注册即送 3 个月黄金,但仅在促销期内(2027-05-01 前);之后注册回落 L1。
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_ref_code  text := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'referred_by_code', '')), '');
  v_valid_ref boolean := false;
  v_promo     boolean := now() < TIMESTAMPTZ '2027-05-01 00:00:00+00';  -- 促销是否仍开放
BEGIN
  IF v_ref_code IS NOT NULL THEN
    v_ref_code := upper(v_ref_code);
    SELECT EXISTS(SELECT 1 FROM public.users WHERE upper(referral_code) = v_ref_code) INTO v_valid_ref;
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
    CASE WHEN v_promo THEN 'L2' ELSE 'L1' END,
    CASE WHEN v_promo THEN now() + interval '3 months' ELSE NULL END  -- 3 个月黄金
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

-- ③ 修正现有数据(去掉保底后没人掉级):
-- 3a) 被误写成 2027-05-01 的 → 改成「注册日 + 3 个月」。
UPDATE public.users
   SET membership_expires_at = created_at + interval '3 months'
 WHERE membership_level = 'L2'
   AND membership_expires_at::date = date '2027-05-01';

-- 3b) 现为 L1 且无到期日(此前靠启动期保底才显示黄金)→ 也当启动期会员,从现在起送 3 个月。
UPDATE public.users
   SET membership_level = 'L2',
       membership_expires_at = now() + interval '3 months'
 WHERE membership_level = 'L1'
   AND membership_expires_at IS NULL;
