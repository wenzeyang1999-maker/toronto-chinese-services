-- Event RSVP: turn the "activity wall" into something people can actually join.
-- event_attendees holds who's going; events.attendee_count is kept in sync by a
-- trigger (same pattern as community like_count) so the count is cheap to read.

CREATE TABLE IF NOT EXISTS public.event_attendees (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON public.event_attendees (user_id);

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS attendee_count int NOT NULL DEFAULT 0;

ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

-- Each user manages (and only sees) their own RSVP rows. The public count lives
-- on events.attendee_count, so the attendee list itself stays private.
DROP POLICY IF EXISTS "rsvp insert own" ON public.event_attendees;
CREATE POLICY "rsvp insert own" ON public.event_attendees
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "rsvp delete own" ON public.event_attendees;
CREATE POLICY "rsvp delete own" ON public.event_attendees
  FOR DELETE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "rsvp read own" ON public.event_attendees;
CREATE POLICY "rsvp read own" ON public.event_attendees
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.sync_event_attendee_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events SET attendee_count = attendee_count + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events SET attendee_count = greatest(0, attendee_count - 1) WHERE id = OLD.event_id;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_event_attendee_count ON public.event_attendees;
CREATE TRIGGER trg_event_attendee_count
  AFTER INSERT OR DELETE ON public.event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_attendee_count();
