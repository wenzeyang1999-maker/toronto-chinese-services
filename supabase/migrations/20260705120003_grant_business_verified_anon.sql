-- ─── Grant business_verified to anon ─────────────────────────────────────────
-- The public services feed joins users and selects `business_verified` (a
-- non-sensitive trust badge). anon was never granted this column, so every
-- anonymous home-page load failed with "permission denied for column
-- business_verified" — the services query 403'd for logged-out visitors.
-- (Authenticated users were unaffected — they have full column access.)
--
-- business_verified is already shown publicly on service cards, so exposing it
-- to anon is correct, not a leak.

GRANT SELECT (business_verified) ON public.users TO anon;
