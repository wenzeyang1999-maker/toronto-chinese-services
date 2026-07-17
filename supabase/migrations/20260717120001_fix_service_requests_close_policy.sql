-- ─── FIX: 发布者无法关闭自己的需求（status→closed 被 RLS 拦下）────────────────
-- 现象：任何把 service_requests.status 改成 'closed' 的写入都返回
--   42501 "new row violates row-level security policy for table service_requests"
-- 而只改 title / expires_at（status 仍为 open）则成功。说明线上 UPDATE 策略的
-- WITH CHECK 事实上要求 status='open'（应为早期 RLS 批量重写误加），导致「关闭
-- 需求」在详情页、报价请求级联、我的交易处全部静默失败。
--
-- 修复：删除 service_requests 上所有 UPDATE 命令的策略（不论其被重写成什么名字），
-- 重建一条「仅发布者可改自己的行、且不限制新 status 值」的 owner 策略。
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'service_requests'
       AND cmd        = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.service_requests', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Owner can update/close"
  ON public.service_requests
  FOR UPDATE
  USING      (auth.uid() = user_id)   -- 只能改自己发布的行
  WITH CHECK (auth.uid() = user_id);  -- 改完仍须属于自己（不再限制 status，可关闭）
