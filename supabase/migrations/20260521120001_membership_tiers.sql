-- ─── Membership tiers ───────────────────────────────────────────────────────
-- Single source of truth for membership level definitions. The benefits array
-- holds the benefits NEW to that tier; the frontend shows "包含上一级全部权益"
-- so each tier visibly stacks on top of the previous one.
--
-- users.membership_level (L1/L2/L3) references these by level string.

CREATE TABLE IF NOT EXISTS public.membership_tiers (
  level       TEXT    PRIMARY KEY,        -- 'L1' | 'L2' | 'L3'
  name        TEXT    NOT NULL,
  tagline     TEXT    NOT NULL,
  price_note  TEXT    NOT NULL DEFAULT '',
  benefits    TEXT[]  NOT NULL DEFAULT '{}',
  sort_order  INT     NOT NULL DEFAULT 0
);

ALTER TABLE public.membership_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can read membership tiers" ON public.membership_tiers;
CREATE POLICY "anyone can read membership tiers"
  ON public.membership_tiers FOR SELECT USING (true);

-- ── Seed / refresh the three tiers ──────────────────────────────────────────
INSERT INTO public.membership_tiers (level, name, tagline, price_note, benefits, sort_order)
VALUES
  ('L1', '普通会员', '注册即享，免费开启', '免费',
   ARRAY[
     '注册即获得绿色会员标识',
     '可发布服务帖子',
     '可接收客户询价消息',
     '基础个人主页展示'
   ], 1),
  ('L2', '黄金会员', '更高曝光，更受信任', '联系管理员开通',
   ARRAY[
     '专属黄金会员标识，更显信任感',
     '服务在搜索结果中优先展示',
     '主页黄金认证徽章',
     '发布数量上限提升'
   ], 2),
  ('L3', '至尊会员', '顶级曝光，平台力荐', '联系管理员开通',
   ARRAY[
     '至尊黑金标识，顶级视觉辨识度',
     '服务帖子置顶展示',
     '首页推荐位曝光机会',
     '不限服务发布数量',
     '专属客服优先支持'
   ], 3)
ON CONFLICT (level) DO UPDATE SET
  name       = EXCLUDED.name,
  tagline    = EXCLUDED.tagline,
  price_note = EXCLUDED.price_note,
  benefits   = EXCLUDED.benefits,
  sort_order = EXCLUDED.sort_order;
