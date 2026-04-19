-- ─── Promo Requests ──────────────────────────────────────────────────────────
-- Providers submit a request; admins approve/reject in the backend.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS public.promo_requests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  UUID        NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  provider_id UUID        NOT NULL REFERENCES public.users(id)   ON DELETE CASCADE,
  note        TEXT,
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_promo_requests_status     ON public.promo_requests (status);
CREATE INDEX IF NOT EXISTS idx_promo_requests_provider   ON public.promo_requests (provider_id);
CREATE INDEX IF NOT EXISTS idx_promo_requests_service    ON public.promo_requests (service_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_requests_one_pending_per_service
  ON public.promo_requests (service_id)
  WHERE status = 'pending';

ALTER TABLE public.promo_requests ENABLE ROW LEVEL SECURITY;

-- Provider can submit their own requests
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='promo_requests' AND policyname='providers can insert own promo requests') THEN
    CREATE POLICY "providers can insert own promo requests"
      ON public.promo_requests FOR INSERT
      WITH CHECK (
        auth.uid() = provider_id
        AND EXISTS (
          SELECT 1
          FROM public.services s
          WHERE s.id = service_id
            AND s.provider_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Provider can view their own; admin can view all
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='promo_requests' AND policyname='providers view own promo requests') THEN
    CREATE POLICY "providers view own promo requests"
      ON public.promo_requests FOR SELECT
      USING (auth.uid() = provider_id OR public.is_admin());
  END IF;
END $$;

-- Only admins can update status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='promo_requests' AND policyname='admins update promo requests') THEN
    CREATE POLICY "admins update promo requests"
      ON public.promo_requests FOR UPDATE
      USING (public.is_admin());
  END IF;
END $$;

-- ── Admin RPC: approve or reject ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_approve_promo_request(
  request_id uuid,
  approved   boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  req RECORD;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO req FROM public.promo_requests WHERE id = request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'request already reviewed'; END IF;

  UPDATE public.promo_requests
  SET status      = CASE WHEN approved THEN 'approved' ELSE 'rejected' END,
      reviewed_at = now()
  WHERE id = request_id;

  IF approved THEN
    UPDATE public.services SET is_promoted = true WHERE id = req.service_id;
  END IF;

  INSERT INTO public.admin_audit_logs(actor_id, action_type, target_type, target_id, details)
  VALUES (
    auth.uid(),
    CASE WHEN approved THEN 'promote_on' ELSE 'promote_request_rejected' END,
    'service',
    req.service_id::text,
    jsonb_build_object('request_id', request_id, 'note', req.note)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_approve_promo_request(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_approve_promo_request(uuid, boolean) TO authenticated;
