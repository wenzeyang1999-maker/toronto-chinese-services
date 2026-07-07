-- ─── SECURITY (H1): re-lock is_promoted on jobs / events / properties ────────
-- is_promoted exists on services, secondhand (both already locked) AND on jobs,
-- events, properties. The sweep (120011) dropped those three tables' guards, so
-- an owner could self-promote via a direct update. Re-lock with a generic
-- SECURITY DEFINER helper that reads the row's committed is_promoted (single
-- scalar, RLS-bypassed → no recursion, no multi-row error).

CREATE OR REPLACE FUNCTION public.row_is_promoted(p_table text, p_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE v boolean;
BEGIN
  EXECUTE format('SELECT is_promoted FROM public.%I WHERE id = $1', p_table)
    INTO v USING p_id;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.row_is_promoted(text, uuid) TO authenticated, anon;

DROP POLICY IF EXISTS "poster can update own jobs" ON public.jobs;
CREATE POLICY "poster can update own jobs" ON public.jobs FOR UPDATE
  USING (auth.uid() = poster_id)
  WITH CHECK (auth.uid() = poster_id AND is_promoted = public.row_is_promoted('jobs', id));

DROP POLICY IF EXISTS "poster can update own events" ON public.events;
CREATE POLICY "poster can update own events" ON public.events FOR UPDATE
  USING (auth.uid() = poster_id)
  WITH CHECK (auth.uid() = poster_id AND is_promoted = public.row_is_promoted('events', id));

DROP POLICY IF EXISTS "poster can update own properties" ON public.properties;
CREATE POLICY "poster can update own properties" ON public.properties FOR UPDATE
  USING (auth.uid() = poster_id)
  WITH CHECK (auth.uid() = poster_id AND is_promoted = public.row_is_promoted('properties', id));
