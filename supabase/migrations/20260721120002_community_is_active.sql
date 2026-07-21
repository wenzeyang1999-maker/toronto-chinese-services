-- ─── 社区帖加隐藏字段（供图片补审命中时自动下架）──────────────────────────────
-- community_posts 原本没有下架/隐藏字段。加 is_active（默认 true，历史帖不受影响）。
-- 公开读取查询需过滤 is_active=true（前端已改）；admin 后台不过滤、可见全部。
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_community_posts_active
  ON public.community_posts(is_active) WHERE is_active = false;
