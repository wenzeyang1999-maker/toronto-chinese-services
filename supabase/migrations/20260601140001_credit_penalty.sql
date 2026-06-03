-- Admin-settable credit deduction for reported/penalized users.
-- Subtracted from the computed credit score (floor 0) and visible in CreditStars breakdown.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS credit_penalty INT NOT NULL DEFAULT 0;

-- RPC for admin to apply (add to) a user's credit penalty.
-- Increments the existing penalty rather than overwriting, so multiple reports stack.
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
  IF penalty_pts < 1 OR penalty_pts > 10 THEN
    RAISE EXCEPTION 'penalty_pts must be between 1 and 10';
  END IF;

  UPDATE public.users
     SET credit_penalty = LEAST(credit_penalty + penalty_pts, 10)
   WHERE id = target_user_id;
END;
$$;
