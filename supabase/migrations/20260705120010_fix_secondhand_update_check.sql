-- ─── Fix broken is_promoted guard on secondhand UPDATE ──────────────────────
-- "seller can update own listings" had WITH CHECK:
--   auth.uid() = seller_id
--   AND is_promoted = (SELECT is_promoted FROM secondhand secondhand_1 WHERE …)
-- whose correlated subquery was mis-written and returned MULTIPLE rows, so every
-- seller UPDATE (incl. 「标记已售出」) failed with 21000 "more than one row
-- returned by a subquery". Intent: sellers must not self-promote (flip
-- is_promoted). Re-express that lock with a SECURITY DEFINER helper that fetches
-- the row's committed is_promoted as a single scalar — no correlation ambiguity.

CREATE OR REPLACE FUNCTION public.secondhand_is_promoted(p_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT is_promoted FROM public.secondhand WHERE id = p_id
$$;

GRANT EXECUTE ON FUNCTION public.secondhand_is_promoted(uuid) TO authenticated, anon;

DROP POLICY IF EXISTS "seller can update own listings" ON public.secondhand;
CREATE POLICY "seller can update own listings"
  ON public.secondhand
  FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (
    auth.uid() = seller_id
    AND is_promoted = public.secondhand_is_promoted(id)
  );
