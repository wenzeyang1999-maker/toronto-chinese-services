-- ─── Users Table RLS Fix ─────────────────────────────────────────────────────
-- Problem: "public can read all users" policy (USING true) exposes every
--          user's phone, wechat, and email to anonymous HTTP requests.
--
-- Fix:
--  1. Drop the open SELECT policy.
--  2. Users can only read their own full row (phone/wechat/email stay private).
--  3. A SECURITY DEFINER helper lets admins read all rows without RLS recursion.
--  4. Admins get a separate SELECT policy via that helper.
--  5. A VIEW exposes safe display fields (name, avatar) for public consumption.
--
-- After running this, update any frontend query that reads another user's data
-- to use .from('public_profiles') instead of .from('users').
-- Safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Drop the open policy ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "public can read all users" ON public.users;


-- ── 2. Users can read their own full profile ──────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "users read own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── 3. SECURITY DEFINER helper — avoids recursion in the admin policy ─────────
-- Calling is_admin() inside a policy on users would normally cause infinite
-- recursion (policy checks users → reads users → policy checks users …).
-- SECURITY DEFINER runs as the function owner and bypasses RLS, breaking
-- the cycle cleanly.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$;


-- ── 4. Admins can read all users ──────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "admins can read all users"
    ON public.users FOR SELECT
    USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── 5. Public profiles view ───────────────────────────────────────────────────
-- Safe display fields accessible to everyone (anon + authenticated).
-- Rules:
--   • phone / wechat are NEVER exposed here (use the service/property listing)
--   • email is exposed only for providers/admins (they want to be contacted)
--   • social_links, is_email_verified, phone_verified are safe to show publicly
-- Frontend: use .from('public_profiles') wherever reading another user's data.
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT
    id,
    name,
    avatar_url,
    bio,
    created_at,
    last_seen_at,
    role,
    membership_level,
    business_verified,
    avg_reply_hours,
    is_email_verified,
    phone_verified,
    social_links,
    -- email only visible for providers / admins (they opt-in by listing services)
    CASE WHEN role IN ('provider', 'admin') THEN email ELSE NULL END AS email
  FROM public.users;

GRANT SELECT ON public.public_profiles TO anon, authenticated;


-- ── 6. Storage LIST restriction ───────────────────────────────────────────────
-- Problem: SELECT policies on storage.objects use USING (bucket_id = 'xxx')
-- which allows any anonymous caller to list every user's folder.
-- Fix: restrict LIST (SELECT) to own folder; keep GET (download) public via
-- a separate policy on the public bucket access level.
--
-- Note: run this AFTER ensuring the buckets exist in Supabase Storage.

-- avatars — list own folder only
DO $$ BEGIN
  CREATE POLICY "avatars list own folder only"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'avatars'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- service-images — list own folder only
DO $$ BEGIN
  CREATE POLICY "service images list own folder only"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'service-images'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- NOTE: To keep avatars / service images publicly downloadable via direct URL,
-- set the buckets to "Public" in Supabase Dashboard → Storage → bucket settings.
-- Public buckets serve GET requests by URL without going through RLS SELECT,
-- so the LIST restriction above only blocks enumeration, not individual downloads.
