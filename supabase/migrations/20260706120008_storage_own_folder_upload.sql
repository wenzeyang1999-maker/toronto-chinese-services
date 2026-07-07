-- ─── SECURITY: storage upload must be to the uploader's own folder ───────────
-- The "Authenticated users can upload service images" policy only checked the
-- bucket, not the path owner — so any logged-in user could upload to
-- qualifications/{victim_id}/… (impersonate/overwrite another user's files).
-- Replace it with a policy that requires the uploader's uid to be a segment of
-- the object path. Every real upload path already embeds the uid
-- ({uid}/…, realestate/{uid}/…, qualifications/{uid}/…, secondhand/{uid}/… etc),
-- so legitimate uploads pass; forged paths are denied.
--
-- (These were applied by hand in the dashboard; this migration version-controls
--  them so a DB rebuild keeps the fix.)

DROP POLICY IF EXISTS "Authenticated users can upload service images" ON storage.objects;

DROP POLICY IF EXISTS "own folder upload" ON storage.objects;
CREATE POLICY "own folder upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK ( auth.uid()::text = ANY (storage.foldername(name)) );
