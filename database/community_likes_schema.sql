-- ─── Community Likes Schema ───────────────────────────────────────────────────
-- Tracks which users liked which posts (prevents duplicate likes).
-- like_count on community_posts is updated via optimistic UI + DB sync.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS community_likes (
  user_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id  UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_community_likes_post ON community_likes (post_id);

ALTER TABLE community_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "users can read own likes"
    ON community_likes FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "users can insert own like"
    ON community_likes FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "users can delete own like"
    ON community_likes FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
