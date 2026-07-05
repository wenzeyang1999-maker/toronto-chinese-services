-- ─── Keep inquiry ↔ public service_request close-state in sync (DB-level) ─────
-- inquiries and service_requests are two tables written together on one submit.
-- Frontend cascades always miss some path (bulk SQL, admin, a forgotten call),
-- so enforce the link in the database: closing either side closes the other.
-- Guards on OLD.status (+ WHERE status='open') make cascade updates hit 0 rows
-- once a row is already closed, so the mutual triggers can't recurse forever.

-- inquiry closed → close its public demand post(s)
CREATE OR REPLACE FUNCTION public.sync_close_service_requests()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    UPDATE public.service_requests sr
    SET status = 'closed', lat = NULL, lng = NULL
    WHERE sr.status = 'open'
      AND ( sr.inquiry_id = NEW.id
            OR ( sr.inquiry_id IS NULL
                 AND sr.user_id = NEW.user_id
                 AND sr.category = NEW.category_id
                 AND abs(extract(epoch FROM (sr.created_at - NEW.created_at))) <= 120 ) );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_inquiry_close_sync ON public.inquiries;
CREATE TRIGGER trg_inquiry_close_sync
  AFTER UPDATE OF status ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.sync_close_service_requests();

-- public demand post closed → close its inquiry
CREATE OR REPLACE FUNCTION public.sync_close_inquiries()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    UPDATE public.inquiries i
    SET status = 'closed'
    WHERE i.status = 'open'
      AND ( i.id = NEW.inquiry_id
            OR ( i.user_id = NEW.user_id
                 AND i.category_id = NEW.category
                 AND abs(extract(epoch FROM (i.created_at - NEW.created_at))) <= 120 ) );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_request_close_sync ON public.service_requests;
CREATE TRIGGER trg_request_close_sync
  AFTER UPDATE OF status ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_close_inquiries();

-- One-time cleanup: close any public post whose matching inquiry is already closed.
UPDATE public.service_requests sr
SET status = 'closed', lat = NULL, lng = NULL
WHERE sr.status = 'open'
  AND EXISTS (
    SELECT 1 FROM public.inquiries i
    WHERE i.status = 'closed'
      AND ( i.id = sr.inquiry_id
            OR ( sr.inquiry_id IS NULL AND i.user_id = sr.user_id AND i.category_id = sr.category
                 AND abs(extract(epoch FROM (i.created_at - sr.created_at))) <= 120 ) )
  );
