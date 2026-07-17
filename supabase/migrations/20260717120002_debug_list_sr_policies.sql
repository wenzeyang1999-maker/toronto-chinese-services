-- TEMP introspection: list live RLS policies on service_requests so we can see
-- the actual USING / WITH CHECK the production DB is enforcing (they differ from
-- the repo). Dropped again in the follow-up fix migration.
CREATE OR REPLACE FUNCTION public._debug_sr_policies()
RETURNS TABLE(policyname text, cmd text, permissive text, roles text, qual text, with_check text)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT policyname::text, cmd::text, permissive::text, roles::text, qual::text, with_check::text
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'service_requests'
$$;
GRANT EXECUTE ON FUNCTION public._debug_sr_policies() TO anon, authenticated;
