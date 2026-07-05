-- ─── Read receipts (已读回执) ─────────────────────────────────────────────────
-- Per-side "last read" timestamps on conversations. WhatsApp/WeChat-style: the
-- sender sees 已读 on their latest message once the other party's last_read_at
-- passes that message's created_at. No per-message writes — one column update
-- when a participant opens the chat (piggybacks the existing unread reset).

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS client_last_read_at   timestamptz,
  ADD COLUMN IF NOT EXISTS provider_last_read_at timestamptz;

-- Realtime: the sender's client needs UPDATE events on the conversation row so
-- the receipt flips to 已读 the moment the other side reads. Add the table to
-- the realtime publication if it isn't already a member.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- already published
  WHEN undefined_object THEN NULL;  -- publication absent in this environment
END $$;
