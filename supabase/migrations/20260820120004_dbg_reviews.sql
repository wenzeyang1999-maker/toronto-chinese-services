CREATE OR REPLACE FUNCTION public._dbg_reviews()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT jsonb_build_object(
    'indexes', (SELECT jsonb_agg(indexdef) FROM pg_indexes WHERE schemaname='public' AND tablename='reviews'),
    'submit_review_src', (SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='submit_review' LIMIT 1)
  )
$$;
GRANT EXECUTE ON FUNCTION public._dbg_reviews() TO anon, authenticated;
