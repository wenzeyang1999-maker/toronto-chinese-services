-- ─── Low-risk column guards: inquiries / community like_count / views ────────

-- 1) inquiries owner-UPDATE had no column guard → the owner could write any uid
--    into accepted_provider_ids (the column the SELECT policy uses to grant read)
--    or flip race_status, i.e. inject a fake lead (with their own contact) into
--    an arbitrary provider's queue and grant them read of the inquiry. Only the
--    match function (service_role) and the accept RPC (SECURITY DEFINER) should
--    touch those two columns. Lock them for the owner; status / assigned_provider_id
--    stay editable (that's what the frontend actually writes).
CREATE OR REPLACE FUNCTION public.inquiry_accepted_ids(p_id uuid)
RETURNS uuid[] LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT accepted_provider_ids FROM public.inquiries WHERE id = p_id
$$;
GRANT EXECUTE ON FUNCTION public.inquiry_accepted_ids(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.inquiry_race_status(p_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT race_status FROM public.inquiries WHERE id = p_id
$$;
GRANT EXECUTE ON FUNCTION public.inquiry_race_status(uuid) TO authenticated;

DROP POLICY IF EXISTS "owner can update own inquiries" ON public.inquiries;
CREATE POLICY "owner can update own inquiries"
  ON public.inquiries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND accepted_provider_ids IS NOT DISTINCT FROM public.inquiry_accepted_ids(id)
    AND race_status           IS NOT DISTINCT FROM public.inquiry_race_status(id)
  );

-- 2) community_posts.like_count:
--    a) the maintaining trigger was NOT SECURITY DEFINER, so a non-author's like
--       hit the author-only UPDATE RLS and silently failed to bump the count.
--       Make it SECURITY DEFINER (also lets us guard the column below).
--    b) the author-UPDATE policy had no guard → the author could set like_count
--       to any value. Lock it: like_count must equal its committed value; the
--       trigger (now DEFINER) is the only writer.
CREATE OR REPLACE FUNCTION public.sync_community_like_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_like_count(p_id uuid)
RETURNS int LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT like_count FROM public.community_posts WHERE id = p_id
$$;
GRANT EXECUTE ON FUNCTION public.community_like_count(uuid) TO authenticated, anon;

DROP POLICY IF EXISTS "authors can update own post" ON public.community_posts;
CREATE POLICY "authors can update own post"
  ON public.community_posts FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id AND like_count = public.community_like_count(id));

-- 3) views INSERT was WITH CHECK(true). Count inflation is a vanity-metric issue
--    (frontend dedups via localStorage) and is accepted as-is, but at least stop
--    attributing a view to another specific user — viewer_id must be null (anon)
--    or the caller.
DROP POLICY IF EXISTS "anyone can insert view" ON public.views;
CREATE POLICY "anyone can insert view"
  ON public.views FOR INSERT
  WITH CHECK (viewer_id IS NULL OR viewer_id = auth.uid());
