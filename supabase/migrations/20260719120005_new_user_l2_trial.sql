-- 新注册用户自动获赠 L2 黄金会员 3 个月（冷启动福利）。
-- 到期后 effective_member_level() 自动回落 L1，额度也随之收紧。
-- 只影响此后新建的账号；已存在用户不变。适用于所有注册方式(邮箱/手机/Google)。

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
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
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'referred_by_code', '')), ''),
    'L2',
    now() + interval '3 months'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
