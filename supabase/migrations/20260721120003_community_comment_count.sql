-- ─── 社区帖评论数去规范化（发/删评论自动维护，前端一次查询即可）──────────────
-- 原来前端每次进大多广场都要再查一遍 community_comments 来数评论数（帖子/评论多了
-- 会越来越慢）。改成在 community_posts 上维护 comment_count 字段（与 like_count 同法）。

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS comment_count int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.sync_community_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_community_comment_count ON public.community_comments;
CREATE TRIGGER trg_community_comment_count
AFTER INSERT OR DELETE ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.sync_community_comment_count();

-- 回填历史评论数
UPDATE public.community_posts p
   SET comment_count = COALESCE(c.n, 0)
  FROM (SELECT post_id, count(*) AS n FROM public.community_comments GROUP BY post_id) c
 WHERE p.id = c.post_id;
