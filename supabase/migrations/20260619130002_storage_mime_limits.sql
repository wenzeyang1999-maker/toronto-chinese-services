-- Storage hardening: restrict the public image buckets to image MIME types and a
-- size cap, enforced by Supabase Storage on upload. Client-side validateImageFile
-- can be bypassed by calling the storage API directly; this is the server-side gate
-- that stops arbitrary binaries (exe/zip/…) being uploaded as a ".jpg".

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  file_size_limit    = 5242880  -- 5 MB (client compresses to ~2.5 MB)
WHERE id IN ('service-images', 'avatars');
