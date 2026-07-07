-- ── ai_call_log: append-only per-IP rate-limit ledger for the AI endpoints ───
-- ai-chat and extract-inquiry are intentionally unauthenticated (used before
-- login) and each proxies Groq. With no limit, an anonymous caller could hammer
-- them and burn the Groq quota / run up cost. This ledger records one row per
-- accepted call keyed by client IP + function name; the functions count recent
-- rows per (ip, fn) and reject over the threshold. Rows past the window are
-- swept opportunistically. Only service-role Edge Functions touch it.
CREATE TABLE IF NOT EXISTS public.ai_call_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ip         text        NOT NULL,
  fn         text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_call_log ENABLE ROW LEVEL SECURITY;
-- No policies — clients are denied; service role bypasses RLS.

CREATE INDEX IF NOT EXISTS ai_call_log_ip_fn_idx ON public.ai_call_log(ip, fn, created_at);
