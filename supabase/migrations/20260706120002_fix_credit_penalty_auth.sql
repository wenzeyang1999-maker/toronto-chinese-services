-- ─── SECURITY (Critical / C2): admin_apply_credit_penalty had no auth ────────
-- The RPC is SECURITY DEFINER but never checked the caller is an admin, and (as
-- a function) EXECUTE defaults to PUBLIC — so anyone with the anon key could
-- penalize any user's credit up to the cap, en masse. Add an is_admin() gate and
-- restrict EXECUTE to authenticated (the gate is the real guard).

CREATE OR REPLACE FUNCTION public.admin_apply_credit_penalty(
  target_user_id UUID,
  penalty_pts    INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF penalty_pts < 1 OR penalty_pts > 10 THEN
    RAISE EXCEPTION 'penalty_pts must be between 1 and 10';
  END IF;

  UPDATE public.users
     SET credit_penalty = LEAST(credit_penalty + penalty_pts, 10)
   WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_apply_credit_penalty(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_apply_credit_penalty(UUID, INT) TO authenticated;
