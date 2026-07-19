-- ── Admin access to feedback ──────────────────────────────────────────────────
-- The existing SELECT policy only lets a user see their OWN feedback, so the
-- admin console can't read the queue. Add admin read + status-update policies
-- (policies are OR'd, so users keep seeing only their own submissions).
CREATE POLICY "admin read all feedback"
  ON public.feedback FOR SELECT
  USING (public.is_admin());

CREATE POLICY "admin update feedback"
  ON public.feedback FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());
