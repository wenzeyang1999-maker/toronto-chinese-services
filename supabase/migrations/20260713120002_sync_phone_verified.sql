-- Phone-OTP signup/login already proves the number (auth.users.phone_confirmed_at
-- gets set on verifyOtp), but public.users.phone_verified stayed false, so the
-- 身份验证 page still showed “去验证” and would make the user verify a SECOND time
-- through the separate in-app OTP. Sync phone_verified from the auth confirmation
-- so a phone-registered account is already verified.

CREATE OR REPLACE FUNCTION public.sync_phone_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.phone_confirmed_at IS NOT NULL THEN
    UPDATE public.users
      SET phone_verified = true,
          phone = COALESCE(NULLIF(trim(phone), ''), NEW.phone)
    WHERE id = NEW.id
      AND phone_verified IS DISTINCT FROM true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_phone_confirmed ON auth.users;
CREATE TRIGGER on_auth_phone_confirmed
  AFTER INSERT OR UPDATE OF phone_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_phone_verified();

-- Backfill anyone whose auth phone is already confirmed.
UPDATE public.users u
   SET phone_verified = true
  FROM auth.users a
 WHERE a.id = u.id
   AND a.phone_confirmed_at IS NOT NULL
   AND u.phone_verified IS DISTINCT FROM true;
