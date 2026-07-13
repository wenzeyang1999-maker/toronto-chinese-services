-- Phone-OTP signups have no email, but public.users.email was NOT NULL, so the
-- handle_new_user() trigger threw 23502 and the whole signInWithOtp failed with a
-- 500 (surfaced to the client as "验证码发送失败") — the SMS hook was never reached.
--
-- Fix: (1) email is legitimately null for phone-only accounts → drop NOT NULL;
--      (2) populate phone from the auth record's own phone column (NEW.phone) for
--          native phone signups, falling back to the metadata field for email signups.

ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  INSERT INTO public.users (id, name, email, phone, role, referral_code, referred_by_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', '用户'),
    NEW.email,
    COALESCE(NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''), NEW.phone),
    'user',
    public.generate_referral_code(),
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'referred_by_code', '')), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
