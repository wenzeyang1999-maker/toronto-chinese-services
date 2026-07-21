-- ─── 延迟图片补审队列（额度用光时的安全网）─────────────────────────────────────
-- 上传时同步审核（客户端 512px 缩略图 → qwen）；若额度用光/出错，fail-open 放行，
-- 并把该图入队。定时任务额度恢复后自动补审；命中违规 → 隐藏内容 + 通知 admin/发布者。

CREATE TABLE IF NOT EXISTS public.image_review_queue (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.users(id) ON DELETE CASCADE,
  image_url   text NOT NULL,
  target_type text NOT NULL,   -- service / secondhand / property / event
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','passed','flagged','error')),
  reason      text,
  created_at  timestamptz DEFAULT now(),
  reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_irq_pending
  ON public.image_review_queue(status, created_at) WHERE status = 'pending';

ALTER TABLE public.image_review_queue ENABLE ROW LEVEL SECURITY;
-- 登录用户只能给自己入队（客户端在 fail-open 时调用）；写入即插，不可改。
DROP POLICY IF EXISTS "enqueue own image review" ON public.image_review_queue;
CREATE POLICY "enqueue own image review" ON public.image_review_queue
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
-- admin 可读（后台查看补审命中）。补审/隐藏走 service_role（绕过 RLS）。
DROP POLICY IF EXISTS "admin read image review" ON public.image_review_queue;
CREATE POLICY "admin read image review" ON public.image_review_queue
  FOR SELECT USING (public.is_admin());

-- ── 定时补审：每 10 分钟调 process-image-queue 边缘函数清一批待审 ──────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

SELECT cron.unschedule('drain-image-review')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-image-review');

SELECT cron.schedule(
  'drain-image-review',
  '*/10 * * * *',
  $$
  DO $inner$
  DECLARE v_url text; v_key text;
  BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'tcs_supabase_url' LIMIT 1;
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'tcs_service_role_key' LIMIT 1;
    IF v_url IS NULL OR v_key IS NULL THEN RETURN; END IF;
    -- 仅在有待审时才调用，省调用
    IF NOT EXISTS (SELECT 1 FROM public.image_review_queue WHERE status = 'pending') THEN RETURN; END IF;
    PERFORM net.http_post(
      url     := v_url || '/functions/v1/process-image-queue',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
      body    := '{}'::jsonb
    );
  END $inner$;
  $$
);
