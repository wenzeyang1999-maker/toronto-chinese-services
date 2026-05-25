-- ── phone_otps: stores short-lived OTP codes for phone verification ──────────
-- Only Edge Functions (service role) access this table — no RLS policies needed
-- beyond enabling RLS to block direct client access.

CREATE TABLE IF NOT EXISTS public.phone_otps (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone      text        NOT NULL,
  code       text        NOT NULL,
  attempts   int         NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE policies — only service-role Edge Functions touch this table.

CREATE INDEX IF NOT EXISTS phone_otps_user_phone_idx ON public.phone_otps(user_id, phone);
CREATE INDEX IF NOT EXISTS phone_otps_expires_idx    ON public.phone_otps(expires_at);

-- Add phone_verified column to users if it doesn't exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;
