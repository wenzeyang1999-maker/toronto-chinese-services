-- ═════════════════════════════════════════════════════════════════════════════
-- TCS — Combined Patch Runner
-- Generated: 2026-04-28
--
-- Run this ONCE in Supabase Dashboard → SQL Editor.
-- All scripts are idempotent (safe to re-run).
--
-- Execution order (dependency-safe):
--   1. users_rls_fix.sql               — is_admin() + public_profiles view
--   2. community_reports_and_admin_logs — report tables + notifications + audit_logs
--   3. admin_backend_patch.sql          — admin policies on jobs/properties/etc
--   4. admin_rpc.sql                    — SECURITY DEFINER admin functions
--   5. commercial_hardening_patch.sql   — referral code generator + view update
--   6. conversation_rpc.sql             — increment_conversation_unread RPC
--   7. inquiry_matches_rls_patch.sql    — tighten inquiry_matches write policy
--   8. push_subscriptions_schema.sql    — web push subscription table
-- ═════════════════════════════════════════════════════════════════════════════


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


-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Community Reports + Admin Audit Logs ───────────────────────────────────
-- Adds:
--  1. community_post_reports  : users can report community posts
--  2. admin_audit_logs        : admin-side operation trail
--  3. notifications           : in-app reminders for admins/users
-- Safe to run multiple times.

-- ── community_post_reports ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_post_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID       NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  reporter_id  UUID       NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason       VARCHAR(50) NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (post_id, reporter_id),

  CONSTRAINT community_post_reports_reason_check CHECK (
    reason IN ('irrelevant', 'malicious', 'fake', 'spam', 'other')
  ),
  CONSTRAINT community_post_reports_status_check CHECK (
    status IN ('pending', 'dismissed', 'removed')
  )
);

CREATE INDEX IF NOT EXISTS idx_community_post_reports_post_id
  ON public.community_post_reports (post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_reports_reporter_id
  ON public.community_post_reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_community_post_reports_status
  ON public.community_post_reports (status);

ALTER TABLE public.community_post_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_post_reports'
      AND policyname = 'users can read own community reports'
  ) THEN
    CREATE POLICY "users can read own community reports"
      ON public.community_post_reports FOR SELECT
      USING (reporter_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_post_reports'
      AND policyname = 'users can insert community report'
  ) THEN
    CREATE POLICY "users can insert community report"
      ON public.community_post_reports FOR INSERT
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND reporter_id = auth.uid()
        AND NOT EXISTS (
          SELECT 1
          FROM public.community_posts p
          WHERE p.id = post_id
            AND p.author_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_post_reports'
      AND policyname = 'admins can manage community post reports'
  ) THEN
    CREATE POLICY "admins can manage community post reports"
      ON public.community_post_reports FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- ── notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,
  title          TEXT NOT NULL,
  body           TEXT,
  link_url       TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created_at
  ON public.notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at
  ON public.notifications (read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON public.notifications (type);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'users can read own notifications'
  ) THEN
    CREATE POLICY "users can read own notifications"
      ON public.notifications FOR SELECT
      USING (recipient_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'users can update own notifications'
  ) THEN
    CREATE POLICY "users can update own notifications"
      ON public.notifications FOR UPDATE
      USING (recipient_id = auth.uid())
      WITH CHECK (recipient_id = auth.uid());
  END IF;
END $$;

-- ── admin_audit_logs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID       NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action_type   TEXT       NOT NULL,
  target_type   TEXT       NOT NULL,
  target_id     TEXT,
  details       JSONB      NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_id
  ON public.admin_audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target
  ON public.admin_audit_logs (target_type, target_id);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_audit_logs'
      AND policyname = 'admins can read audit logs'
  ) THEN
    CREATE POLICY "admins can read audit logs"
      ON public.admin_audit_logs FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- ── community_comment_reports ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_comment_reports (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id    UUID        NOT NULL REFERENCES public.community_comments(id) ON DELETE CASCADE,
  reporter_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason        VARCHAR(50) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (comment_id, reporter_id),

  CONSTRAINT community_comment_reports_reason_check CHECK (
    reason IN ('irrelevant', 'malicious', 'fake', 'spam', 'other')
  ),
  CONSTRAINT community_comment_reports_status_check CHECK (
    status IN ('pending', 'dismissed', 'removed')
  )
);

CREATE INDEX IF NOT EXISTS idx_community_comment_reports_comment_id
  ON public.community_comment_reports (comment_id);
CREATE INDEX IF NOT EXISTS idx_community_comment_reports_reporter_id
  ON public.community_comment_reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_community_comment_reports_status
  ON public.community_comment_reports (status);

ALTER TABLE public.community_comment_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_comment_reports'
      AND policyname = 'users can read own community comment reports'
  ) THEN
    CREATE POLICY "users can read own community comment reports"
      ON public.community_comment_reports FOR SELECT
      USING (reporter_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_comment_reports'
      AND policyname = 'users can insert community comment report'
  ) THEN
    CREATE POLICY "users can insert community comment report"
      ON public.community_comment_reports FOR INSERT
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND reporter_id = auth.uid()
        AND NOT EXISTS (
          SELECT 1
          FROM public.community_comments c
          WHERE c.id = comment_id
            AND c.author_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_comment_reports'
      AND policyname = 'admins can manage community comment reports'
  ) THEN
    CREATE POLICY "admins can manage community comment reports"
      ON public.community_comment_reports FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_audit_logs'
      AND policyname = 'admins can insert audit logs'
  ) THEN
    CREATE POLICY "admins can insert audit logs"
      ON public.admin_audit_logs FOR INSERT
      WITH CHECK (
        actor_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Admin Backend Patch ─────────────────────────────────────────────────────
-- Completes missing admin-side RLS permissions for dashboard actions.
-- Safe to run multiple times.
--
-- Notes:
-- 1. This patch intentionally checks table existence before touching policies.
-- 2. It assumes public.users already exists and includes a role column.
-- 3. If a target table has not been created yet, that section is skipped.

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE NOTICE 'Skip admin backend patch: public.users does not exist yet';
    RETURN;
  END IF;
END $$;

-- jobs
DO $$
BEGIN
  IF to_regclass('public.jobs') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'jobs'
        AND policyname = 'admins can manage all jobs'
    ) THEN
      CREATE POLICY "admins can manage all jobs"
        ON public.jobs FOR ALL
        USING (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
  ELSE
    RAISE NOTICE 'Skip policy admins can manage all jobs: public.jobs does not exist yet';
  END IF;
END $$;

-- properties
DO $$
BEGIN
  IF to_regclass('public.properties') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'properties'
        AND policyname = 'admins can manage all properties'
    ) THEN
      CREATE POLICY "admins can manage all properties"
        ON public.properties FOR ALL
        USING (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
  ELSE
    RAISE NOTICE 'Skip policy admins can manage all properties: public.properties does not exist yet';
  END IF;
END $$;

-- secondhand
DO $$
BEGIN
  IF to_regclass('public.secondhand') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'secondhand'
        AND policyname = 'admins can manage all secondhand'
    ) THEN
      CREATE POLICY "admins can manage all secondhand"
        ON public.secondhand FOR ALL
        USING (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
  ELSE
    RAISE NOTICE 'Skip policy admins can manage all secondhand: public.secondhand does not exist yet';
  END IF;
END $$;

-- events
DO $$
BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'events'
        AND policyname = 'admins can manage all events'
    ) THEN
      CREATE POLICY "admins can manage all events"
        ON public.events FOR ALL
        USING (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
  ELSE
    RAISE NOTICE 'Skip policy admins can manage all events: public.events does not exist yet';
  END IF;
END $$;

-- community_posts
DO $$
BEGIN
  IF to_regclass('public.community_posts') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'community_posts'
        AND policyname = 'admins can manage all community posts'
    ) THEN
      CREATE POLICY "admins can manage all community posts"
        ON public.community_posts FOR ALL
        USING (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
  ELSE
    RAISE NOTICE 'Skip policy admins can manage all community posts: public.community_posts does not exist yet';
  END IF;
END $$;

-- community_comments
DO $$
BEGIN
  IF to_regclass('public.community_comments') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'community_comments'
        AND policyname = 'admins can manage all community comments'
    ) THEN
      CREATE POLICY "admins can manage all community comments"
        ON public.community_comments FOR ALL
        USING (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
  ELSE
    RAISE NOTICE 'Skip policy admins can manage all community comments: public.community_comments does not exist yet';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Admin RPC Functions ───────────────────────────────────────────────────────
-- All high-risk admin actions now run SECURITY DEFINER on the server.
-- Each function:
--   1. Verifies the caller is an admin (via is_admin() — already defined in users_rls_fix.sql)
--   2. Performs the DB change atomically
--   3. Writes an audit log row
--
-- Frontend calls: supabase.rpc('function_name', { ... })
-- Safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Set user role (ban / unban / promote to provider) ─────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  target_user_id uuid,
  new_role        text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF new_role NOT IN ('user', 'provider', 'admin', 'banned') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;

  UPDATE public.users SET role = new_role WHERE id = target_user_id;

  INSERT INTO public.admin_audit_logs(actor_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), 'user_role_updated', 'user', target_user_id::text,
          jsonb_build_object('role', new_role));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;


-- ── 2. Approve or reject a verification request ───────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_review_verification(
  target_user_id uuid,
  approved        boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.users
  SET verification_status = CASE WHEN approved THEN 'approved' ELSE 'rejected' END,
      business_verified   = approved
  WHERE id = target_user_id;

  INSERT INTO public.admin_audit_logs(actor_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(),
          CASE WHEN approved THEN 'verification_approved' ELSE 'verification_rejected' END,
          'user', target_user_id::text, '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_review_verification(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_verification(uuid, boolean) TO authenticated;


-- ── 3. Toggle promoted flag on any supported table ────────────────────────────
-- table_name must be one of the whitelisted values (no SQL injection possible).
CREATE OR REPLACE FUNCTION public.admin_toggle_promoted(
  item_id    uuid,
  table_name text,
  promoted   boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF table_name NOT IN ('services', 'jobs', 'properties', 'secondhand', 'events') THEN
    RAISE EXCEPTION 'invalid table';
  END IF;

  EXECUTE format('UPDATE public.%I SET is_promoted = $1 WHERE id = $2', table_name)
    USING promoted, item_id;

  INSERT INTO public.admin_audit_logs(actor_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(),
          CASE WHEN promoted THEN 'promote_on' ELSE 'promote_off' END,
          table_name, item_id::text,
          jsonb_build_object('promoted', promoted));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_toggle_promoted(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_toggle_promoted(uuid, text, boolean) TO authenticated;


-- ── 4. Set inquiry status ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_inquiry_status(
  inquiry_id uuid,
  new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF new_status NOT IN ('open', 'matched', 'closed') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  UPDATE public.inquiries SET status = new_status WHERE id = inquiry_id;

  INSERT INTO public.admin_audit_logs(actor_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), 'inquiry_status_updated', 'inquiry', inquiry_id::text,
          jsonb_build_object('status', new_status));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_inquiry_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_inquiry_status(uuid, text) TO authenticated;


-- ── 5. Delete a community post (and close all its reports atomically) ─────────
CREATE OR REPLACE FUNCTION public.admin_delete_community_post(
  post_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.community_post_reports
  SET status = 'removed'
  WHERE post_id = admin_delete_community_post.post_id
    AND status = 'pending';

  DELETE FROM public.community_posts WHERE id = post_id;

  INSERT INTO public.admin_audit_logs(actor_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), 'community_post_deleted', 'community_post', post_id::text, '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_community_post(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_community_post(uuid) TO authenticated;


-- ── 6. Delete a community comment (and close all its reports atomically) ──────
CREATE OR REPLACE FUNCTION public.admin_delete_community_comment(
  comment_id uuid,
  post_id    uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.community_comment_reports
  SET status = 'removed'
  WHERE community_comment_reports.comment_id = admin_delete_community_comment.comment_id
    AND status = 'pending';

  DELETE FROM public.community_comments WHERE id = comment_id;

  INSERT INTO public.admin_audit_logs(actor_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), 'community_comment_report_removed', 'community_comment', comment_id::text,
          jsonb_build_object('post_id', post_id));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_community_comment(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_community_comment(uuid, uuid) TO authenticated;


-- ── 7. Grant or revoke membership ─────────────────────────────────────────────
-- Pass new_level='L1' and new_expires_at=NULL to revoke.
CREATE OR REPLACE FUNCTION public.admin_set_membership(
  target_user_id uuid,
  new_level      text,
  new_expires_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  action_label text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF new_level NOT IN ('L1', 'L2', 'L3') THEN
    RAISE EXCEPTION 'invalid membership level';
  END IF;

  UPDATE public.users
  SET membership_level      = new_level,
      membership_expires_at = new_expires_at
  WHERE id = target_user_id;

  action_label := CASE WHEN new_level = 'L1' THEN 'membership_revoked' ELSE 'membership_granted' END;

  INSERT INTO public.admin_audit_logs(actor_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), action_label, 'user', target_user_id::text,
          jsonb_build_object('level', new_level, 'expires_at', new_expires_at));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_membership(uuid, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_membership(uuid, text, timestamptz) TO authenticated;


-- ── 8. Set service availability (takedown / restore) ─────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_service_availability(
  service_id uuid,
  available  boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.services SET is_available = available WHERE id = service_id;

  INSERT INTO public.admin_audit_logs(actor_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(),
          CASE WHEN available THEN 'service_restored' ELSE 'service_takedown' END,
          'service', service_id::text, '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_service_availability(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_service_availability(uuid, boolean) TO authenticated;


-- ── 9. Bulk set service availability ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_bulk_set_service_availability(
  service_ids uuid[],
  available   boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF array_length(service_ids, 1) IS NULL THEN RETURN; END IF;

  UPDATE public.services SET is_available = available
  WHERE id = ANY(service_ids);

  INSERT INTO public.admin_audit_logs(actor_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), 'service_bulk_takedown', 'service', NULL,
          jsonb_build_object('ids', service_ids, 'available', available));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_bulk_set_service_availability(uuid[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bulk_set_service_availability(uuid[], boolean) TO authenticated;


-- ── 10. Remove a review and close its report ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_remove_review(
  review_id uuid,
  report_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.review_reports
  SET status = 'removed'
  WHERE review_id = admin_remove_review.review_id;

  DELETE FROM public.reviews WHERE id = review_id;

  INSERT INTO public.admin_audit_logs(actor_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), 'review_removed', 'review', review_id::text,
          jsonb_build_object('report_id', report_id));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_remove_review(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_review(uuid, uuid) TO authenticated;


-- ── 11. Dismiss a review report ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_dismiss_review_report(
  report_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.review_reports SET status = 'dismissed' WHERE id = report_id;

  INSERT INTO public.admin_audit_logs(actor_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), 'review_report_dismissed', 'review_report', report_id::text, '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_dismiss_review_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dismiss_review_report(uuid) TO authenticated;


-- ── 12. Dismiss a community post report ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_dismiss_community_post_report(
  report_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.community_post_reports SET status = 'dismissed' WHERE id = report_id;

  INSERT INTO public.admin_audit_logs(actor_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), 'community_report_dismissed', 'community_post_report', report_id::text, '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_dismiss_community_post_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dismiss_community_post_report(uuid) TO authenticated;


-- ── 13. Dismiss a community comment report ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_dismiss_community_comment_report(
  report_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.community_comment_reports SET status = 'dismissed' WHERE id = report_id;

  INSERT INTO public.admin_audit_logs(actor_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), 'community_comment_report_dismissed', 'community_comment_report', report_id::text, '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_dismiss_community_comment_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dismiss_community_comment_report(uuid) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Commercial Hardening Patch ─────────────────────────────────────────────
-- Safe follow-up patch for production environments.
--
-- What it does:
-- 1. Tightens public_profiles so public pages stop depending on raw users rows.
-- 2. Removes referral_code from public exposure.
-- 3. Replaces 7-char deterministic referral codes for future generations with
--    a collision-resistant generator.
-- 4. Updates handle_new_user() and ensure_my_referral_code() to use the new generator.
--
-- Safe to run multiple times.

-- ── 1. Safer public profile view ─────────────────────────────────────────────
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
    CASE WHEN role IN ('provider', 'admin') THEN email ELSE NULL END AS email
  FROM public.users;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ── 2. Referral code generator for future users ─────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  candidate TEXT;
BEGIN
  LOOP
    candidate := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.users WHERE referral_code = candidate
    );
  END LOOP;

  RETURN candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_referral_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_referral_code() TO authenticated;

-- ── 3. Update new-user trigger ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, phone, role, referral_code, referred_by_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', '用户'),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    'user',
    public.generate_referral_code(),
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'referred_by_code', '')), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Self-heal helper now uses the safe generator ──────────────────────────
CREATE OR REPLACE FUNCTION public.ensure_my_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  repaired_code TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.users
  SET referral_code = public.generate_referral_code()
  WHERE id = auth.uid() AND referral_code IS NULL;

  SELECT referral_code
  INTO repaired_code
  FROM public.users
  WHERE id = auth.uid();

  RETURN repaired_code;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_referral_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_my_referral_code() TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Conversation RPC Functions ───────────────────────────────────────────────
-- Atomic operations on the conversations table that are unsafe to do
-- with a read-modify-write pattern from the frontend.
-- Safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Atomically increment one unread counter ───────────────────────────────────
-- Replaces the frontend's SELECT-then-UPDATE pattern which loses increments
-- when two messages arrive simultaneously.
-- col_name must be 'client_unread' or 'provider_unread' (whitelisted).
CREATE OR REPLACE FUNCTION public.increment_conversation_unread(
  conv_id  uuid,
  col_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_participant boolean;
BEGIN
  IF col_name NOT IN ('client_unread', 'provider_unread') THEN
    RAISE EXCEPTION 'invalid column: %', col_name;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.conversations
    WHERE id = conv_id
      AND (client_id = auth.uid() OR provider_id = auth.uid())
  )
  INTO is_participant;

  IF NOT is_participant THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  EXECUTE format(
    'UPDATE public.conversations SET %I = %I + 1 WHERE id = $1',
    col_name, col_name
  ) USING conv_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_conversation_unread(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_conversation_unread(uuid, text) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════

-- Tighten inquiry_matches writes so clients can no longer forge provider match rows.
-- The match-inquiry-providers Edge Function should insert these rows using service_role.

DROP POLICY IF EXISTS "service can insert inquiry_matches" ON inquiry_matches;
DROP POLICY IF EXISTS "service role can insert inquiry_matches" ON inquiry_matches;

CREATE POLICY "service role can insert inquiry_matches"
  ON inquiry_matches
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "users can read own inquiry_matches" ON inquiry_matches;

CREATE POLICY "users can read own inquiry_matches"
  ON inquiry_matches
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.inquiries
      WHERE inquiries.id = inquiry_matches.inquiry_id
        AND inquiries.user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Web Push Subscriptions Schema
-- Stores per-device subscription endpoints so the server can send push.
-- Safe to run multiple times.
-- Requires: users table already exists.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT         NOT NULL,
  p256dh      TEXT         NOT NULL,  -- subscription public key
  auth        TEXT         NOT NULL,  -- subscription auth secret
  user_agent  TEXT,

  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- A device's endpoint is unique per user (re-subscribing replaces it)
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscriptions
DROP POLICY IF EXISTS "push_subs_select_own" ON push_subscriptions;
CREATE POLICY "push_subs_select_own"
  ON push_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own subscription
DROP POLICY IF EXISTS "push_subs_insert_own" ON push_subscriptions;
CREATE POLICY "push_subs_insert_own"
  ON push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update / delete their own subscription
DROP POLICY IF EXISTS "push_subs_update_own" ON push_subscriptions;
CREATE POLICY "push_subs_update_own"
  ON push_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subs_delete_own" ON push_subscriptions;
CREATE POLICY "push_subs_delete_own"
  ON push_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ENDPOINT DEDUPE TRIGGER
-- A web push endpoint is browser/device-scoped, not user-scoped. If a different
-- user signed in on the same browser and re-subscribed, two rows would point
-- to the same endpoint and the previous user could receive notifications meant
-- for the new owner. This trigger atomically removes any foreign-user rows
-- for the endpoint when one is inserted or updated. SECURITY DEFINER bypasses
-- RLS so it can clean up rows the calling user doesn't own.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION push_subs_endpoint_dedupe()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM push_subscriptions
   WHERE endpoint = NEW.endpoint
     AND id != NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_subs_endpoint_dedupe_trg ON push_subscriptions;
CREATE TRIGGER push_subs_endpoint_dedupe_trg
  AFTER INSERT OR UPDATE OF endpoint ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION push_subs_endpoint_dedupe();


-- ═══════════════════════════════════════════════════════════════════════════

-- Fix: users_role_check constraint was missing 'banned' in older DB instances.
-- schema.sql already has the correct definition; this patch aligns live DBs.
DO $$ BEGIN
  ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE public.users ADD CONSTRAINT users_role_check
    CHECK (role IN ('user', 'provider', 'admin', 'banned'));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'users_role_check patch skipped: %', SQLERRM;
END $$;
