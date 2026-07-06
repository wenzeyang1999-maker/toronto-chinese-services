-- ─── SECURITY (Low / L1): set search_path on the sync-close trigger fns ──────
-- Both SECURITY DEFINER functions from 20260705120007 lacked SET search_path,
-- leaving them open to search_path hijacking. Re-create with a fixed path.
-- Bodies are unchanged.

CREATE OR REPLACE FUNCTION public.sync_close_service_requests()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

CREATE OR REPLACE FUNCTION public.sync_close_inquiries()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
