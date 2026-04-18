-- ─── Referral Repair Helpers ────────────────────────────────────────────────
-- Repairs missing referral_code values for users created while an older
-- handle_new_user() trigger definition was active.

-- Backfill any missing codes in bulk.
UPDATE public.users
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL;

-- Let an authenticated user self-heal their own code from the app.
CREATE OR REPLACE FUNCTION public.ensure_my_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  repaired_code TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.users
  SET referral_code = public.generate_referral_code()
  WHERE id = auth.uid() AND referral_code IS NULL;

  SELECT referral_code
  INTO repaired_code
  FROM public.users
  WHERE id = auth.uid();

  RETURN repaired_code;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_referral_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_my_referral_code() TO authenticated;
