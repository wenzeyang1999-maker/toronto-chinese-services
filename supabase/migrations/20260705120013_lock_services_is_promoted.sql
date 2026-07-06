-- ─── Lock is_promoted on services (only admin / promo RPC may set it) ────────
-- is_promoted (paid/member「置顶推广」) exists on services + secondhand only
-- (jobs/properties use is_filled — an owner's own action, not locked). The
-- sweep dropped services' guard, so a provider could self-promote via a direct
-- update. Re-lock it: on an owner update, is_promoted must equal its committed
-- value. The free-promotion path (use_free_promotion) and admin are unaffected —
-- both run with RLS bypassed (SECURITY DEFINER RPC / is_admin policy).

CREATE OR REPLACE FUNCTION public.services_is_promoted(p_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT is_promoted FROM public.services WHERE id = p_id
$$;
GRANT EXECUTE ON FUNCTION public.services_is_promoted(uuid) TO authenticated, anon;

DROP POLICY IF EXISTS "providers can update own services" ON public.services;
CREATE POLICY "providers can update own services"
  ON public.services
  FOR UPDATE
  USING (auth.uid() = provider_id)
  WITH CHECK (
    auth.uid() = provider_id
    AND is_promoted = public.services_is_promoted(id)
  );
