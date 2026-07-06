-- ─── URGENT: restore the anti-escalation guard on users profile updates ──────
-- The previous sweep (20260705120011) mis-classified "users can update own
-- profile" as a broken guard and simplified its WITH CHECK to just
-- (auth.uid() = id) — which would let a user UPDATE their own row to set
-- role='admin' / phone_verified / business_verified (privilege escalation).
-- Its guard was actually CORRECT (single-row lookups by PK). Restore it, using
-- SECURITY DEFINER helpers to read the committed values (no RLS recursion).

CREATE OR REPLACE FUNCTION public.my_phone_verified()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT phone_verified FROM public.users WHERE id = auth.uid()
$$;
CREATE OR REPLACE FUNCTION public.my_business_verified()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT business_verified FROM public.users WHERE id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.my_phone_verified()    TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.my_business_verified() TO authenticated, anon;

DROP POLICY IF EXISTS "users can update own profile" ON public.users;
CREATE POLICY "users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role IN ('user', 'provider')                       -- no self-escalation to admin
    AND business_verified = public.my_business_verified()  -- can't self-verify
    AND phone_verified    = public.my_phone_verified()
  );
