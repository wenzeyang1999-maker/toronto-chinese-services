-- ─── Admin-only user search (restores email lookup after the email 收口) ─────
-- Clients can no longer filter public.users by email (REVOKE'd), so the console
-- search boxes lost "find a user by email". This SECURITY DEFINER RPC does the
-- keyword match (name / email / referral_code) server-side and returns only the
-- matching ids — is_admin()-gated, so it is not an email scrape vector. The tab
-- then loads its own columns for those ids and attaches emails via the admin RPC.
CREATE OR REPLACE FUNCTION public.admin_search_user_ids(p_kw text)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RETURN; END IF;
  IF p_kw IS NULL OR btrim(p_kw) = '' THEN RETURN; END IF;
  RETURN QUERY
    SELECT u.id
      FROM public.users u
     WHERE u.name          ILIKE '%' || p_kw || '%'
        OR u.email         ILIKE '%' || p_kw || '%'
        OR u.referral_code ILIKE '%' || p_kw || '%'
     ORDER BY u.created_at DESC
     LIMIT 50;
END $$;
REVOKE ALL ON FUNCTION public.admin_search_user_ids(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_search_user_ids(text) TO authenticated;
