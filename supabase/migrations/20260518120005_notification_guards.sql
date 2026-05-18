-- ─── Persistent rate-limit table + relationship-validation RPC ──────────────
-- Replaces the in-memory rate limit (which reset on edge function cold start)
-- with a DB-backed sliding window, and adds a single RPC that the edge function
-- calls before each notification: it verifies the caller has a legitimate
-- relationship with the recipient for the given type, AND that the caller is
-- within the rate limit. One round trip handles both checks.

-- ── Rate limit table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_rate_limits (
  actor_id      UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  window_start  TIMESTAMPTZ  NOT NULL,
  count         INT          NOT NULL DEFAULT 1,
  PRIMARY KEY (actor_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_notification_rate_limits_window
  ON public.notification_rate_limits (window_start);

ALTER TABLE public.notification_rate_limits ENABLE ROW LEVEL SECURITY;
-- No client policies — only SECURITY DEFINER RPC can touch this table.

-- ── Combined check: rate limit + relationship validation ─────────────────────
-- Returns true if the actor may send the notification, false otherwise.
-- p_actor_id     — caller (already authenticated in edge function)
-- p_recipient_id — target user
-- p_type         — notification type
-- p_context      — jsonb with type-specific fields (conversation_id, service_id, etc.)
-- p_max_per_min  — rate limit ceiling (default 30)
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
  v_window     TIMESTAMPTZ;
  v_current    INT;
  v_relation_ok BOOLEAN := false;
BEGIN
  -- Truncate to current minute as the sliding window key
  v_window := date_trunc('minute', NOW());

  -- Rate limit check + atomic increment
  INSERT INTO notification_rate_limits (actor_id, window_start, count)
  VALUES (p_actor_id, v_window, 1)
  ON CONFLICT (actor_id, window_start)
  DO UPDATE SET count = notification_rate_limits.count + 1
  RETURNING count INTO v_current;

  IF v_current > p_max_per_min THEN
    RETURN false;
  END IF;

  -- Relationship validation by type
  CASE p_type
    WHEN 'new_message' THEN
      -- Actor must be a participant of the conversation, recipient is the other party
      v_relation_ok := EXISTS (
        SELECT 1 FROM conversations
        WHERE id = (p_context->>'conversationId')::uuid
          AND ((client_id = p_actor_id AND provider_id = p_recipient_id)
            OR (provider_id = p_actor_id AND client_id = p_recipient_id))
      );

    WHEN 'new_follower' THEN
      -- Actor just followed recipient → row in follows table
      v_relation_ok := EXISTS (
        SELECT 1 FROM follows
        WHERE follower_id = p_actor_id AND provider_id = p_recipient_id
      );

    WHEN 'new_review' THEN
      -- Actor wrote a review on a service owned by recipient
      v_relation_ok := EXISTS (
        SELECT 1 FROM reviews r
        JOIN services s ON s.id = r.service_id
        WHERE r.reviewer_id = p_actor_id
          AND s.provider_id = p_recipient_id
      );

    WHEN 'new_question' THEN
      -- Actor asked a question on a service owned by recipient
      v_relation_ok := EXISTS (
        SELECT 1 FROM questions q
        JOIN services s ON s.id = q.service_id
        WHERE q.asker_id = p_actor_id
          AND s.provider_id = p_recipient_id
      );

    WHEN 'new_service_post', 'new_community_post', 'new_listing_post' THEN
      -- Recipient must be following the actor
      v_relation_ok := EXISTS (
        SELECT 1 FROM follows
        WHERE follower_id = p_recipient_id AND provider_id = p_actor_id
      );

    ELSE
      -- Unknown type — reject by default
      v_relation_ok := false;
  END CASE;

  RETURN v_relation_ok;
END;
$$;

REVOKE ALL ON FUNCTION public.check_notification_allowed(UUID, UUID, TEXT, JSONB, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_notification_allowed(UUID, UUID, TEXT, JSONB, INT) TO service_role;

-- ── Cleanup: drop entries older than 5 minutes (cheap, runs hourly via cron) ─
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('cleanup-notification-rate-limits')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-notification-rate-limits');

SELECT cron.schedule(
  'cleanup-notification-rate-limits',
  '0 * * * *',
  $$ DELETE FROM public.notification_rate_limits WHERE window_start < NOW() - INTERVAL '5 minutes' $$
);
