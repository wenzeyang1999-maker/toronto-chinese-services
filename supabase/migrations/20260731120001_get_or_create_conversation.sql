-- 🔴 恢复 + 版本化 get_or_create_conversation ——「联系发布者 / 发消息 / 站内私信客户」
-- 三个入口唯一的建会话通道。该函数当初在后台手动创建、从未进迁移,某次 DB 操作后丢失
-- (线上 pg_proc 查无此函数),导致新用户之间点"联系/发消息"报「无法发起会话」,抢单→
-- 成交的桥梁断裂。此处按 conversations 真实表结构重建,并纳入版本控制,避免再次丢失。
--
-- 语义:按 (client_id, provider_id, service_id) 复用已有会话,没有则新建;返回会话 id
-- (前端 navigate(state:{conversationId: data}) 直接使用)。前端三处均以 service_id=null 调用,
-- 即"每个 客户×商家 一条会话"。SECURITY DEFINER 绕过 RLS 完成读/写,当事人校验用 auth.uid()。

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  p_client_id   uuid,
  p_provider_id uuid,
  p_service_id  uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- 调用者必须是会话双方之一
  IF auth.uid() IS NULL OR auth.uid() NOT IN (p_client_id, p_provider_id) THEN
    RAISE EXCEPTION '无权发起该会话' USING ERRCODE = 'check_violation';
  END IF;
  IF p_client_id = p_provider_id THEN
    RAISE EXCEPTION '不能与自己发起会话' USING ERRCODE = 'check_violation';
  END IF;

  -- 复用已有会话（service_id 用 IS NOT DISTINCT FROM 以正确匹配 NULL）
  SELECT id INTO v_id
  FROM public.conversations
  WHERE client_id = p_client_id
    AND provider_id = p_provider_id
    AND service_id IS NOT DISTINCT FROM p_service_id
  LIMIT 1;

  IF v_id IS NULL THEN
    BEGIN
      INSERT INTO public.conversations (client_id, provider_id, service_id)
      VALUES (p_client_id, p_provider_id, p_service_id)
      RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
      -- 并发下另一个请求已建 → 回读
      SELECT id INTO v_id
      FROM public.conversations
      WHERE client_id = p_client_id
        AND provider_id = p_provider_id
        AND service_id IS NOT DISTINCT FROM p_service_id
      LIMIT 1;
    END;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_conversation(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid, uuid, uuid) TO authenticated;
