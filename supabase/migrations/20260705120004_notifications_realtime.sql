-- ─── notifications → realtime publication ────────────────────────────────────
-- The notification bell subscribes to postgres_changes on public.notifications,
-- but the table was never added to the supabase_realtime publication, so the
-- red-dot never appeared live — it only refreshed when the panel was reopened.
-- Add it so new notifications (inquiry dispatch, leads, follows) push instantly.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- already published
  WHEN undefined_object THEN NULL;  -- publication absent in this environment
END $$;
