-- ─── Commercial Hardening Patch ─────────────────────────────────────────────
-- Safe follow-up patch for production environments.
--
-- What it does:
-- 1. Tightens public_profiles so public pages stop depending on raw users rows.
-- 2. Removes referral_code from public exposure.
-- 3. Replaces 7-char deterministic referral codes for future generations with
--    a collision-resistant generator.
-- 4. Updates handle_new_user() and ensure_my_referral_code() to use the new generator.
--
-- Safe to run multiple times.

-- ── 1. Safer public profile view ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT
    id,
    name,
    avatar_url,
    bio,
    created_at,
    last_seen_at,
    role,
    membership_level,
    business_verified,
    avg_reply_hours,
    is_email_verified,
    phone_verified,
    social_links,
    CASE WHEN role IN ('provider', 'admin') THEN email ELSE NULL END AS email
  FROM public.users;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ── 2. Referral code generator for future users ─────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  candidate TEXT;
BEGIN
  LOOP
    candidate := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.users WHERE referral_code = candidate
    );
  END LOOP;

  RETURN candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_referral_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_referral_code() TO authenticated;

-- ── 3. Update new-user trigger ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, phone, role, referral_code, referred_by_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', '用户'),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    'user',
    public.generate_referral_code(),
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'referred_by_code', '')), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Self-heal helper now uses the safe generator ──────────────────────────
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
