-- ── otp_send_log: append-only ledger for OTP send rate-limiting ──────────────
-- send-otp used to rate-limit by counting phone_otps rows for the user, but that
-- table is delete-then-inserted on every send (and mutated/deleted by verify-otp),
-- so the window count never accumulated → the limit was effectively bypassable,
-- and there was NO per-target-phone limit (single account could SMS-bomb any
-- number). This immutable log is written once per delivered SMS and is only ever
-- read for counting (rows older than the window are swept opportunistically), so
-- both the per-user AND per-phone limits are reliable.
--
-- Only service-role Edge Functions touch this table (RLS on, no policies).
CREATE TABLE IF NOT EXISTS public.otp_send_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid,
  phone      text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.otp_send_log ENABLE ROW LEVEL SECURITY;
-- No policies — clients are denied; service role bypasses RLS.

CREATE INDEX IF NOT EXISTS otp_send_log_phone_idx ON public.otp_send_log(phone, created_at);
CREATE INDEX IF NOT EXISTS otp_send_log_user_idx  ON public.otp_send_log(user_id, created_at);
