-- ─── Inquiries: require auth for INSERT ────────────────────────────────────────
-- Previously anyone (including anonymous visitors) could insert into inquiries,
-- which triggers provider notification emails via match-inquiry-providers.
-- That's a spam vector. From now on inquiries must be tied to a logged-in user.

DROP POLICY IF EXISTS "anyone can insert inquiries" ON public.inquiries;

CREATE POLICY "authenticated can insert inquiries"
  ON public.inquiries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Backfill safety: tighten the column too — new rows must have a user_id.
-- (Existing rows with NULL user_id stay as-is for historical audit.)
ALTER TABLE public.inquiries
  ADD CONSTRAINT inquiries_user_id_required_chk
  CHECK (user_id IS NOT NULL) NOT VALID;
