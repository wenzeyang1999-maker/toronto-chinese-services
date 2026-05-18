-- ─── Admin: Top Consumers RPC ────────────────────────────────────────────────
-- Surfaces the most-active users so admins can spot potential spam / abuse.
-- Returns top 10 by message count, service request count, and community post
-- count for the given window (default 1 day).

CREATE OR REPLACE FUNCTION public.admin_top_consumers(p_days INT DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role  TEXT;
  v_msgs  jsonb;
  v_reqs  jsonb;
  v_posts jsonb;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = auth.uid();
  IF v_role <> 'admin' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_agg(t) INTO v_msgs FROM (
    SELECT u.id, u.name, u.email, COUNT(*)::INT AS cnt
    FROM messages m JOIN users u ON u.id = m.sender_id
    WHERE m.created_at > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY u.id, u.name, u.email
    ORDER BY cnt DESC LIMIT 10
  ) t;

  SELECT jsonb_agg(t) INTO v_reqs FROM (
    SELECT u.id, u.name, u.email, COUNT(*)::INT AS cnt
    FROM service_requests sr JOIN users u ON u.id = sr.user_id
    WHERE sr.created_at > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY u.id, u.name, u.email
    ORDER BY cnt DESC LIMIT 10
  ) t;

  SELECT jsonb_agg(t) INTO v_posts FROM (
    SELECT u.id, u.name, u.email, COUNT(*)::INT AS cnt
    FROM community_posts cp JOIN users u ON u.id = cp.author_id
    WHERE cp.created_at > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY u.id, u.name, u.email
    ORDER BY cnt DESC LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'messages', COALESCE(v_msgs, '[]'::jsonb),
    'requests', COALESCE(v_reqs, '[]'::jsonb),
    'posts',    COALESCE(v_posts, '[]'::jsonb),
    'window_days', p_days
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_top_consumers(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_top_consumers(INT) TO authenticated;
