-- ─── Conversation RPC Functions ───────────────────────────────────────────────
-- Atomic operations on the conversations table that are unsafe to do
-- with a read-modify-write pattern from the frontend.
-- Safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Atomically increment one unread counter ───────────────────────────────────
-- Replaces the frontend's SELECT-then-UPDATE pattern which loses increments
-- when two messages arrive simultaneously.
-- col_name must be 'client_unread' or 'provider_unread' (whitelisted).
CREATE OR REPLACE FUNCTION public.increment_conversation_unread(
  conv_id  uuid,
  col_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_participant boolean;
BEGIN
  IF col_name NOT IN ('client_unread', 'provider_unread') THEN
    RAISE EXCEPTION 'invalid column: %', col_name;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.conversations
    WHERE id = conv_id
      AND (client_id = auth.uid() OR provider_id = auth.uid())
  )
  INTO is_participant;

  IF NOT is_participant THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  EXECUTE format(
    'UPDATE public.conversations SET %I = %I + 1 WHERE id = $1',
    col_name, col_name
  ) USING conv_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_conversation_unread(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_conversation_unread(uuid, text) TO authenticated;
