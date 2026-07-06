-- ─── Fix infinite recursion in secondhand policies ──────────────────────────
-- "admins can manage all secondhand" checked admin via an inline
-- `EXISTS (SELECT 1 FROM users …)`. Evaluating that subquery re-triggers RLS on
-- `users`, which cycles back → 42P17 infinite recursion. Because that admin
-- policy is FOR ALL, it is evaluated on every secondhand write, so EVERY
-- authenticated update (e.g. 「标记已售出」) errored out and silently failed.
--
-- Fix: check admin through a SECURITY DEFINER helper that reads `users` with
-- RLS bypassed, so no policy cycle. Also drop the redundant owner-update policy
-- I added (an identical "seller can update own listings" already exists).

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

DROP POLICY IF EXISTS "admins can manage all secondhand" ON public.secondhand;
CREATE POLICY "admins can manage all secondhand"
  ON public.secondhand
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Redundant with the pre-existing "seller can update own listings".
DROP POLICY IF EXISTS "owner can update own secondhand" ON public.secondhand;
