-- Enforce phone verification before users can create content or inquiries.
--
-- Part 1 (prerequisite): lock phone_verified in the users UPDATE policy. Without
-- this a user could simply UPDATE their own row to phone_verified=true and bypass
-- the SMS OTP, making the gate below meaningless. verify-otp sets the flag with
-- the service role (bypasses RLS), so this does not break the legitimate flow.
--
-- Part 2: a BEFORE INSERT trigger that rejects content/inquiry rows whose owner
-- has not verified a phone number. Admins are exempt. Enforced at the DB layer so
-- it can't be bypassed by calling Supabase directly.

-- ── Part 1: lock phone_verified (and keep the existing role / business_verified guards) ──
DROP POLICY IF EXISTS "users can update own profile" ON public.users;

CREATE POLICY "users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role IN ('user', 'provider')                                    -- no self-escalation to admin
    AND business_verified = (SELECT business_verified FROM public.users WHERE id = auth.uid())
    AND phone_verified    = (SELECT phone_verified    FROM public.users WHERE id = auth.uid())
  );

-- ── Part 2: require phone verification on insert ──
CREATE OR REPLACE FUNCTION public.require_phone_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_owner_col TEXT := TG_ARGV[0];
  v_owner     UUID;
  v_verified  BOOLEAN;
  v_role      TEXT;
BEGIN
  v_owner := (to_jsonb(NEW) ->> v_owner_col)::uuid;
  IF v_owner IS NULL THEN
    RETURN NEW;  -- anonymous / system rows are not gated here
  END IF;

  SELECT phone_verified, role INTO v_verified, v_role
  FROM public.users WHERE id = v_owner;

  IF v_role = 'admin' THEN
    RETURN NEW;  -- admins exempt
  END IF;

  IF v_verified IS NOT TRUE THEN
    RAISE EXCEPTION '请先在「个人资料 → 验证」完成手机号验证后再发布'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_phone_services ON public.services;
CREATE TRIGGER trg_require_phone_services BEFORE INSERT ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.require_phone_verified('provider_id');

DROP TRIGGER IF EXISTS trg_require_phone_jobs ON public.jobs;
CREATE TRIGGER trg_require_phone_jobs BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.require_phone_verified('poster_id');

DROP TRIGGER IF EXISTS trg_require_phone_properties ON public.properties;
CREATE TRIGGER trg_require_phone_properties BEFORE INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.require_phone_verified('poster_id');

DROP TRIGGER IF EXISTS trg_require_phone_secondhand ON public.secondhand;
CREATE TRIGGER trg_require_phone_secondhand BEFORE INSERT ON public.secondhand
  FOR EACH ROW EXECUTE FUNCTION public.require_phone_verified('seller_id');

DROP TRIGGER IF EXISTS trg_require_phone_events ON public.events;
CREATE TRIGGER trg_require_phone_events BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.require_phone_verified('poster_id');

DROP TRIGGER IF EXISTS trg_require_phone_community_posts ON public.community_posts;
CREATE TRIGGER trg_require_phone_community_posts BEFORE INSERT ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.require_phone_verified('author_id');

DROP TRIGGER IF EXISTS trg_require_phone_inquiries ON public.inquiries;
CREATE TRIGGER trg_require_phone_inquiries BEFORE INSERT ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.require_phone_verified('user_id');
