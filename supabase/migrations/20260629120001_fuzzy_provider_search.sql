-- Fuzzy provider search by keyword (2026-06-29)
--
-- Problem: the search page matched providers with exact array containment
-- (skill_tags @> ARRAY['维修']), so typing a partial term like "维" returned
-- nothing even though a provider had the tag "维修".
--
-- Fix: an RPC that partial-matches each tag with ILIKE (via unnest), and also
-- matches the provider's name. Returns ONLY public profile columns — never the
-- sensitive PII columns on public.users.
--
-- SECURITY INVOKER (default): the caller's RLS on public.users still governs
-- which rows are visible; we additionally restrict the returned columns here.

CREATE OR REPLACE FUNCTION public.search_providers_by_keyword(kw text)
RETURNS TABLE (
  id            uuid,
  name          text,
  avatar_url    text,
  bio           text,
  is_online     boolean,
  business_type text,
  skill_tags    text[]
)
LANGUAGE sql
STABLE
AS $$
  SELECT u.id, u.name, u.avatar_url, u.bio, u.is_online, u.business_type, u.skill_tags
  FROM public.users u
  WHERE kw <> ''
    AND (
      u.name ILIKE '%' || kw || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(u.skill_tags) AS t WHERE t ILIKE '%' || kw || '%'
      )
    )
  ORDER BY u.is_online DESC NULLS LAST
  LIMIT 6;
$$;

-- Expose to the API roles (RLS on public.users still applies).
GRANT EXECUTE ON FUNCTION public.search_providers_by_keyword(text) TO anon, authenticated;
