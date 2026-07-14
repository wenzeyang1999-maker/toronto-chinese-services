-- ─── A3: 持牌资质 + 商业保险 徽章字段（admin 核验，禁止自设）────────────────────
-- 说明书 §4.3 名片墙筛选维度：持牌资质（绿色芯片）+ 商业保险（盾牌芯片）。
-- 这两项是信任信号，服务商绝不能自己勾选 —— 只有 admin 可核验设置（现为人工，
-- 未来接 AI-OCR = C3）。锁定方式与 business_verified / phone_verified 一致。

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS has_license   boolean NOT NULL DEFAULT false,  -- 持牌资质已核验
  ADD COLUMN IF NOT EXISTS has_insurance boolean NOT NULL DEFAULT false;  -- 商业保险已核验

-- 公开可读（名片墙 / 服务商主页展示）。
GRANT SELECT (has_license)   ON public.users TO anon, authenticated;
GRANT SELECT (has_insurance) ON public.users TO anon, authenticated;

-- 读"已提交值"的 SECURITY DEFINER 助手，供 owner-update 策略锁列用（绕过 RLS，
-- 无递归）。
CREATE OR REPLACE FUNCTION public.my_has_license()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT has_license FROM public.users WHERE id = auth.uid()
$$;
CREATE OR REPLACE FUNCTION public.my_has_insurance()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT has_insurance FROM public.users WHERE id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.my_has_license()   TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.my_has_insurance() TO authenticated, anon;

-- 重建 owner-update 策略，在原有守卫（role / business_verified / phone_verified，
-- 见 20260705120012）之上加入 has_license / has_insurance 两项锁。
DROP POLICY IF EXISTS "users can update own profile" ON public.users;
CREATE POLICY "users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role IN ('user', 'provider')
    AND business_verified = public.my_business_verified()
    AND phone_verified    = public.my_phone_verified()
    AND has_license       = public.my_has_license()
    AND has_insurance     = public.my_has_insurance()
  );

-- admin 专用 setter（人工核验；AI-OCR 见 C3）。is_admin 门 + 收回 PUBLIC。
CREATE OR REPLACE FUNCTION public.admin_set_provider_flags(
  target_user_id  uuid,
  p_has_license   boolean,
  p_has_insurance boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.users
     SET has_license   = p_has_license,
         has_insurance = p_has_insurance
   WHERE id = target_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_provider_flags(uuid, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_provider_flags(uuid, boolean, boolean) TO authenticated;
