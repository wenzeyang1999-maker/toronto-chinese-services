-- ─── Community Likes Schema ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS community_likes (
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_community_likes_post ON community_likes (post_id);

ALTER TABLE community_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own likes"
  ON community_likes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users can insert own like"
  ON community_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can delete own like"
  ON community_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Trigger: auto-maintain like_count ────────────────────────────────────────
-- Replaces manual like_count updates in the frontend.
-- On INSERT → increment; On DELETE → decrement (floor 0).

CREATE OR REPLACE FUNCTION sync_community_like_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER trg_community_like_count
AFTER INSERT OR DELETE ON community_likes
FOR EACH ROW EXECUTE FUNCTION sync_community_like_count();
