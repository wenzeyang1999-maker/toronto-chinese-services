-- ─── SECURITY (Critical / C3 + Medium): tighten anon column grants on users ──
-- 20260524120003 re-granted a broad "safe" column list to anon that included
-- sensitive fields. Revoke the ones anon should never read:
--   • qualification_images — verification-document URLs (business licence / ID).
--     anon could `select qualification_images from users` and enumerate every
--     provider's document URLs, then download them from the public bucket.
--   • referred_by — internal referral graph.
-- online_lat/lng are kept but are now fuzzed on write (C4); business_address is
-- left as a product decision (may be an intentionally public business location).
--
-- Note: fully securing the documents also requires moving them to a PRIVATE
-- storage bucket with signed URLs — tracked separately (bucket config).

REVOKE SELECT (qualification_images) ON public.users FROM anon;
DO $$ BEGIN
  EXECUTE 'REVOKE SELECT (referred_by) ON public.users FROM anon';
EXCEPTION WHEN undefined_column THEN NULL; END $$;
