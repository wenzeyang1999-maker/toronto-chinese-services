-- 成交通知 inquiry_selected 一直进不到站内/邮件:它既不在 send-notification 的
-- USER_ALLOWED_TYPES,关系校验 RPC 的 CASE 也没有它(ELSE 默认拒绝)。这里给 RPC
-- 补上关系规则 —— 客户(actor)选中商家时会把自己的询价 assigned_provider_id 设成
-- 该商家,所以"存在一条该客户的询价、且指派给了这个商家"即为合法关系。
-- (send-notification 端同步把它加入 USER_ALLOWED_TYPES;邮件暂不启用,只建站内红点。)

CREATE OR REPLACE FUNCTION public.check_notification_allowed(
  p_actor_id     UUID,
  p_recipient_id UUID,
  p_type         TEXT,
  p_context      JSONB,
  p_max_per_min  INT DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_window      TIMESTAMPTZ;
  v_current     INT;
  v_relation_ok BOOLEAN := false;
BEGIN
  v_window := date_trunc('minute', NOW());

  INSERT INTO notification_rate_limits (actor_id, window_start, count)
  VALUES (p_actor_id, v_window, 1)
  ON CONFLICT (actor_id, window_start)
  DO UPDATE SET count = notification_rate_limits.count + 1
  RETURNING count INTO v_current;

  IF v_current > p_max_per_min THEN
    RETURN false;
  END IF;

  CASE p_type
    WHEN 'new_message' THEN
      v_relation_ok := EXISTS (
        SELECT 1 FROM conversations
        WHERE id = (p_context->>'conversationId')::uuid
          AND ((client_id = p_actor_id AND provider_id = p_recipient_id)
            OR (provider_id = p_actor_id AND client_id = p_recipient_id))
      );

    WHEN 'new_follower' THEN
      v_relation_ok := EXISTS (
        SELECT 1 FROM follows
        WHERE follower_id = p_actor_id AND provider_id = p_recipient_id
      );

    WHEN 'new_review' THEN
      v_relation_ok := EXISTS (
        SELECT 1 FROM reviews r
        JOIN services s ON s.id = r.service_id
        WHERE r.reviewer_id = p_actor_id
          AND s.provider_id = p_recipient_id
      );

    WHEN 'new_question' THEN
      v_relation_ok := EXISTS (
        SELECT 1 FROM questions q
        JOIN services s ON s.id = q.service_id
        WHERE q.asker_id = p_actor_id
          AND s.provider_id = p_recipient_id
      );

    WHEN 'new_service_post', 'new_community_post', 'new_listing_post' THEN
      v_relation_ok := EXISTS (
        SELECT 1 FROM follows
        WHERE follower_id = p_recipient_id AND provider_id = p_actor_id
      );

    WHEN 'inquiry_selected' THEN
      -- Client selected this provider for one of their inquiries.
      v_relation_ok := EXISTS (
        SELECT 1 FROM inquiries
        WHERE user_id = p_actor_id
          AND assigned_provider_id = p_recipient_id
      );

    ELSE
      v_relation_ok := false;
  END CASE;

  RETURN v_relation_ok;
END;
$$;
