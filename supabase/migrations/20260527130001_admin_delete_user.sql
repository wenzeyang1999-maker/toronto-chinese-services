-- Admin RPC: hard-delete a user from both public.users and auth.users.
-- Caller must have role='admin' in public.users.
-- Deleting public.users cascades to all related public-schema rows first,
-- then the auth.users row is removed so the email can be re-used for signup.

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_catalog
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Access denied: caller is not an admin';
  END IF;

  -- Remove all public-schema data for this user (cascades via FK)
  DELETE FROM public.users WHERE id = p_user_id;

  -- Remove the auth identity so the email can be re-registered
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
