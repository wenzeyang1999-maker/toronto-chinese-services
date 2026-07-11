-- referred_by_code (who referred this user) is only ever written (via signup
-- metadata) — never SELECTed by clients for display. Revoke read so the referral
-- graph can't be scraped.
DO $$ BEGIN
  REVOKE SELECT (referred_by_code) ON public.users FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_column THEN NULL; END $$;
