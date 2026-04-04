-- ─── Community Schema ────────────────────────────────────────────────────────
-- Two tables: community_posts + community_comments
-- Post types: recommend / experience / question / secondhand
-- Areas: north_york / markham / mississauga / scarborough / downtown / brampton / other
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS community_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  area        TEXT NOT NULL DEFAULT 'other'
                CHECK (area IN ('north_york','markham','mississauga','scarborough','downtown','brampton','other')),
  type        TEXT NOT NULL DEFAULT 'question'
                CHECK (type IN ('recommend','experience','question','secondhand')),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  images      TEXT[] DEFAULT '{}',
  like_count  INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_community_posts_area     ON community_posts (area);
CREATE INDEX IF NOT EXISTS idx_community_posts_type     ON community_posts (type);
CREATE INDEX IF NOT EXISTS idx_community_posts_created  ON community_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_comments_post  ON community_comments (post_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE community_posts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments  ENABLE ROW LEVEL SECURITY;

-- community_posts
DO $$ BEGIN
  CREATE POLICY "anyone can read community posts"
    ON community_posts FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated users can post"
    ON community_posts FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = author_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authors can update own post"
    ON community_posts FOR UPDATE
    USING (auth.uid() = author_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authors can delete own post"
    ON community_posts FOR DELETE
    USING (auth.uid() = author_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- community_comments
DO $$ BEGIN
  CREATE POLICY "anyone can read comments"
    ON community_comments FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated users can comment"
    ON community_comments FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = author_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authors can delete own comment"
    ON community_comments FOR DELETE
    USING (auth.uid() = author_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
