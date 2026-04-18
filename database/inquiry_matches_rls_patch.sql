-- Tighten inquiry_matches writes so clients can no longer forge provider match rows.
-- The match-inquiry-providers Edge Function should insert these rows using service_role.

DROP POLICY IF EXISTS "service can insert inquiry_matches" ON inquiry_matches;

CREATE POLICY "service role can insert inquiry_matches"
  ON inquiry_matches
  FOR INSERT
  TO service_role
  WITH CHECK (true);
