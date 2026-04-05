-- ─── 新用户欢迎邮件 DB Trigger ───────────────────────────────────────────────
-- 当新用户插入 public.users 表时，自动调用 send-notification Edge Function
-- 发送欢迎邮件。
--
-- 使用前提：send-notification Edge Function 已部署
--
-- 在 Supabase SQL Editor 执行本文件即可启用。
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. 创建触发函数
CREATE OR REPLACE FUNCTION public.send_welcome_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 异步调用 Edge Function（fire-and-forget）
  PERFORM net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body    := jsonb_build_object(
      'type',           'welcome',
      'recipientEmail', NEW.email,
      'recipientName',  COALESCE(NEW.name, '新用户'),
      'data',           jsonb_build_object()
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- 邮件失败不影响注册流程
  RETURN NEW;
END;
$$;

-- 2. 绑定触发器（插入新用户后触发）
DROP TRIGGER IF EXISTS on_new_user_welcome ON public.users;
CREATE TRIGGER on_new_user_welcome
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.send_welcome_email();
