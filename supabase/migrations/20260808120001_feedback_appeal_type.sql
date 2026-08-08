-- ── 允许「申诉」feedback 类型(内测#2) ────────────────────────────────────────
-- 联系我们卡片新增【申诉】入口(封号/商户认证/举报/评价申诉),复用 feedback 表:
--   type='appeal' · reason_tag=申诉子类型 · target=相关对象 · detail=说明
-- 放宽 type CHECK 接受 'appeal'。后台 FeedbackTab 照常按 status 流转处理。
ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_type_check;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_type_check
  CHECK (type IN ('report', 'complaint', 'suggestion', 'partner', 'appeal'));
