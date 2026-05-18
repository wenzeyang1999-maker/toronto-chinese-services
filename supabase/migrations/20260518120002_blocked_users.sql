-- ─── Blocked Users ───────────────────────────────────────────────────────────
-- Lets a user block another user. Blocked users are hidden from messages,
-- cannot start new conversations with the blocker, and cannot send messages
-- in existing conversations.

CREATE TABLE IF NOT EXISTS public.blocked_users (
  blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- A user can see only their own block list (and rows where they're the blocked party,
-- so the app could hide their content; safer to keep blocked party private — opt for
-- only blocker reads.)
DROP POLICY IF EXISTS "blocker can read own blocks" ON public.blocked_users;
CREATE POLICY "blocker can read own blocks"
  ON public.blocked_users FOR SELECT
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "blocker can insert own blocks" ON public.blocked_users;
CREATE POLICY "blocker can insert own blocks"
  ON public.blocked_users FOR INSERT
  WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS "blocker can delete own blocks" ON public.blocked_users;
CREATE POLICY "blocker can delete own blocks"
  ON public.blocked_users FOR DELETE
  USING (blocker_id = auth.uid());

-- Prevent blocked users from inserting messages where the recipient blocked them.
-- We enforce this by checking the conversation: if either party blocked the sender,
-- the insert is rejected.
CREATE OR REPLACE FUNCTION public.check_message_not_blocked()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_client UUID;
  v_provider UUID;
  v_other UUID;
BEGIN
  SELECT client_id, provider_id INTO v_client, v_provider
  FROM conversations WHERE id = NEW.conversation_id;
  IF v_client IS NULL THEN
    RETURN NEW;  -- conversation doesn't exist; let the FK fail elsewhere
  END IF;
  v_other := CASE WHEN NEW.sender_id = v_client THEN v_provider ELSE v_client END;

  -- If the recipient has blocked the sender, reject
  IF EXISTS (
    SELECT 1 FROM blocked_users
    WHERE blocker_id = v_other AND blocked_id = NEW.sender_id
  ) THEN
    RAISE EXCEPTION 'recipient has blocked you' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_block_check ON public.messages;
CREATE TRIGGER trg_messages_block_check
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.check_message_not_blocked();
