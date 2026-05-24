-- ─── service_requests: precise service-time window ─────────────────────────────
-- Requesters can specify *when* they need the service (start / end timestamps),
-- distinct from `expires_at` (which is when the post itself disappears).
-- Both columns are optional so existing rows stay valid.

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS service_at_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_at_end   TIMESTAMPTZ;

-- Sanity check: end must not be before start (when both set)
ALTER TABLE public.service_requests
  DROP CONSTRAINT IF EXISTS service_requests_time_window_chk;
ALTER TABLE public.service_requests
  ADD  CONSTRAINT service_requests_time_window_chk
       CHECK (service_at_end IS NULL OR service_at_start IS NULL OR service_at_end >= service_at_start);

CREATE INDEX IF NOT EXISTS service_requests_service_at_start_idx
  ON public.service_requests(service_at_start)
  WHERE service_at_start IS NOT NULL;
