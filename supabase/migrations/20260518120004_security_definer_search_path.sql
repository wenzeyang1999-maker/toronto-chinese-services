-- ─── Harden SECURITY DEFINER functions with explicit search_path ─────────────
-- Postgres SECURITY DEFINER functions inherit the caller's search_path by
-- default. A malicious user can create objects in a schema earlier on the
-- search_path and trick an unqualified identifier inside the function into
-- resolving to them. Setting search_path explicitly closes this attack class.
--
-- All public.* SECURITY DEFINER functions in the database get the same
-- treatment: search_path = public, pg_catalog. We enumerate them dynamically
-- so we don't have to maintain a hardcoded signature list.

DO $$
DECLARE
  fn RECORD;
  alter_sql TEXT;
BEGIN
  FOR fn IN
    SELECT
      p.oid::regprocedure::text AS sig,
      n.nspname AS schema_name,
      p.proname AS func_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true               -- SECURITY DEFINER
      AND NOT EXISTS (                     -- skip those already configured
        SELECT 1 FROM unnest(p.proconfig) AS c
        WHERE c LIKE 'search_path=%'
      )
  LOOP
    alter_sql := format(
      'ALTER FUNCTION %s SET search_path = public, pg_catalog',
      fn.sig
    );
    EXECUTE alter_sql;
    RAISE NOTICE 'hardened %', fn.sig;
  END LOOP;
END $$;
