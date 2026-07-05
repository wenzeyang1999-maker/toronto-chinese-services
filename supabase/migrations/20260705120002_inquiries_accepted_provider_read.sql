-- ─── inquiries SELECT policy: owner OR accepted provider ──────────────────────
-- Business flow (confirmed): an inquiry is broadcast to matching providers; the
-- first ≤5 who "抢单" land in accepted_provider_ids[]. Those providers are meant
-- to proactively contact the customer, so they must be able to read the inquiry
-- row (incl. phone/wechat). The customer also sees which providers it went to
-- and may contact them.
--
-- The prior policy was owner-only (auth.uid() = user_id), which silently broke
-- the provider→customer contact path ("我接的单" returned 0 rows). Widen it to
-- also allow providers who actually won a slot — and ONLY them. A merchant who
-- did not accept still reads nothing, so this is not a PII leak: it exposes the
-- customer's contact only to the (≤5) providers the race admitted.
--
-- Only the SELECT policy is changed here. The existing INSERT policy
-- ("authenticated can insert inquiries") and the admin ALL policy
-- ("admins can manage all inquiries") are left intact.

DROP POLICY IF EXISTS "users can read own inquiries" ON public.inquiries;

CREATE POLICY "owner or accepted provider can read inquiries"
  ON public.inquiries
  FOR SELECT
  TO public
  USING (
    auth.uid() = user_id
    OR auth.uid() = ANY (accepted_provider_ids)
  );
