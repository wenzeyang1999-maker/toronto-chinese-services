CREATE OR REPLACE FUNCTION public._dbg_inquiry_triggers()
RETURNS TABLE(tgname text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT t.tgname::text
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname='public' AND c.relname='inquiries' AND NOT t.tgisinternal
$$;
GRANT EXECUTE ON FUNCTION public._dbg_inquiry_triggers() TO anon, authenticated;
