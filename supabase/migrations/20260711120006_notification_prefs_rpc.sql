-- notification_prefs is a private per-user setting (which notification types are
-- on). It was client-readable → anyone could see others' preferences. Move the
-- owner's read behind a SECURITY DEFINER RPC and revoke the column.
CREATE OR REPLACE FUNCTION public.get_my_notification_prefs()
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT notification_prefs FROM public.users WHERE id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.get_my_notification_prefs() TO authenticated;

DO $$ BEGIN
  REVOKE SELECT (notification_prefs) ON public.users FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_column THEN NULL; END $$;
