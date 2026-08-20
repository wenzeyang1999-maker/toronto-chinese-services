-- 四:我的消息 支持删除(单条)+ 一键清空。会话双方共享,做「按人隐藏」并记时间戳:
-- 删除后若对方再发新消息(last_message_at 更新)则重新出现,符合聊天软件常规。

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS client_hidden_at   timestamptz,
  ADD COLUMN IF NOT EXISTS provider_hidden_at timestamptz;

-- 单条删除:把本人一侧的 hidden_at 设为 now()
CREATE OR REPLACE FUNCTION public.hide_conversation(p_conversation_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); c public.conversations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '未登录'; END IF;
  SELECT * INTO c FROM public.conversations WHERE id = p_conversation_id;
  IF c.id IS NULL THEN RETURN; END IF;
  IF    v_uid = c.client_id   THEN UPDATE public.conversations SET client_hidden_at   = now() WHERE id = p_conversation_id;
  ELSIF v_uid = c.provider_id THEN UPDATE public.conversations SET provider_hidden_at = now() WHERE id = p_conversation_id;
  ELSE  RAISE EXCEPTION '无权操作此会话';
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.hide_conversation(uuid) TO authenticated;

-- 一键清空:把本人所有会话都隐藏到 now()
CREATE OR REPLACE FUNCTION public.hide_all_conversations() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '未登录'; END IF;
  UPDATE public.conversations SET client_hidden_at   = now() WHERE client_id   = v_uid;
  UPDATE public.conversations SET provider_hidden_at = now() WHERE provider_id = v_uid;
END $$;
GRANT EXECUTE ON FUNCTION public.hide_all_conversations() TO authenticated;
