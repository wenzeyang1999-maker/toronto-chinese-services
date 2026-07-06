-- ─── Sweep: fix the two policy bug classes across ALL public tables ──────────
-- 1) Recursion: every "admins can …" policy checked admin via an inline
--    EXISTS(SELECT 1 FROM users …). Evaluating that re-triggers users RLS and
--    can cycle → 42P17, blocking writes. Rebuild each to use the SECURITY
--    DEFINER helper is_admin() (bypasses RLS, no cycle). Same admin intent.
-- 2) Multi-row guard: some "… can update own …" UPDATE policies had a broken
--    correlated subquery in WITH CHECK (e.g. locking is_promoted) that returned
--    multiple rows → 21000, blocking every owner update. Rebuild WITH CHECK to
--    just the owner check (= the USING clause), dropping the broken guard.
--
-- is_admin() is created in 20260705120009.

-- ── 1) admin policies → is_admin() ──────────────────────────────────────────
DO $$
DECLARE r record; v_roles text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, cmd, roles
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname ILIKE 'admins can %'
  LOOP
    v_roles := array_to_string(r.roles, ', ');
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    IF r.cmd = 'SELECT' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO %s USING (public.is_admin())',
        r.policyname, r.tablename, v_roles);
    ELSIF r.cmd = 'INSERT' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO %s WITH CHECK (public.is_admin())',
        r.policyname, r.tablename, v_roles);
    ELSIF r.cmd = 'DELETE' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO %s USING (public.is_admin())',
        r.policyname, r.tablename, v_roles);
    ELSE  -- ALL or UPDATE → needs both USING and WITH CHECK
      EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO %s USING (public.is_admin()) WITH CHECK (public.is_admin())',
        r.policyname, r.tablename, r.cmd, v_roles);
    END IF;
    RAISE NOTICE 'rebuilt admin policy % on %', r.policyname, r.tablename;
  END LOOP;
END $$;

-- ── 2) broken owner-update guards → WITH CHECK = USING ───────────────────────
DO $$
DECLARE r record; v_roles text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'UPDATE'
      AND qual IS NOT NULL
      AND with_check IS NOT NULL
      AND with_check ~* '=\s*\(\s*select'   -- a scalar-subquery guard
  LOOP
    v_roles := array_to_string(r.roles, ', ');
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO %s USING (%s) WITH CHECK (%s)',
      r.policyname, r.tablename, v_roles, r.qual, r.qual);
    RAISE NOTICE 'rebuilt update policy % on % (dropped broken guard)', r.policyname, r.tablename;
  END LOOP;
END $$;
