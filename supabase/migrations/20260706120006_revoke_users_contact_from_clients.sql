-- ─── SECURITY (H2): stop clients reading users.phone/wechat directly ─────────
-- authenticated held a table-level SELECT on public.users, so any logged-in user
-- could scrape every user's phone/wechat (customers included). All legitimate
-- reads now go through the get_my_contact / get_contact SECURITY DEFINER RPCs
-- (previous migration + frontend). Revoke the table grant and re-grant every
-- column EXCEPT phone/wechat, so those two are only reachable via the RPCs.
--
-- email is intentionally KEPT for authenticated (admin console reads it; it is a
-- separate, lower-severity follow-up). anon column grants are unaffected.
DO $$
DECLARE cols text;
BEGIN
  REVOKE SELECT ON public.users FROM PUBLIC;
  REVOKE SELECT ON public.users FROM authenticated;

  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'users'
     AND column_name NOT IN ('phone', 'wechat');

  EXECUTE format('GRANT SELECT (%s) ON public.users TO authenticated', cols);
END $$;
