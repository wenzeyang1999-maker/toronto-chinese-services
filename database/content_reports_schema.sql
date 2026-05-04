-- content_reports_schema.sql
-- Unified content reports table that replaces the legacy
-- community_post_reports and community_comment_reports tables.
-- Also adds reporting capability for services, secondhand items, etc.
--
-- Run order: after all prior patches have been applied.
-- Safe to re-run (idempotent via IF NOT EXISTS / OR REPLACE / ON CONFLICT DO NOTHING).

-- ─── 1. Create unified content_reports table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_reports (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type  TEXT        NOT NULL
    CHECK (content_type IN ('community_post', 'community_comment', 'service', 'secondhand', 'job', 'property', 'event')),
  content_id    UUID        NOT NULL,
  content_title TEXT        NOT NULL DEFAULT '',   -- snapshot of title/preview at report time
  reporter_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason        TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'dismissed', 'actioned')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_type, content_id, reporter_id)
);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can insert content_reports"       ON public.content_reports;
DROP POLICY IF EXISTS "users can view own content_reports"     ON public.content_reports;
DROP POLICY IF EXISTS "admin can manage content_reports"       ON public.content_reports;

CREATE POLICY "users can insert content_reports"
  ON public.content_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "users can view own content_reports"
  ON public.content_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR is_admin());

CREATE POLICY "admin can manage content_reports"
  ON public.content_reports FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- ─── 2. Migrate community_post_reports ─────────────────────────────────────────
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'community_post_reports') THEN
    INSERT INTO public.content_reports
      (id, content_type, content_id, content_title, reporter_id, reason, status, created_at)
    SELECT
      r.id,
      'community_post',
      r.post_id,
      COALESCE((SELECT title FROM public.community_posts WHERE id = r.post_id), '（帖子已删除）'),
      r.reporter_id,
      r.reason,
      r.status,
      r.created_at
    FROM public.community_post_reports r
    ON CONFLICT DO NOTHING;
  END IF;
END $mig$;

-- ─── 3. Migrate community_comment_reports ──────────────────────────────────────
DO $mig2$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'community_comment_reports') THEN
    INSERT INTO public.content_reports
      (id, content_type, content_id, content_title, reporter_id, reason, status, created_at)
    SELECT
      r.id,
      'community_comment',
      r.comment_id,
      COALESCE(
        '评论: ' || LEFT((SELECT content FROM public.community_comments WHERE id = r.comment_id), 50),
        '（评论已删除）'
      ),
      r.reporter_id,
      r.reason,
      r.status,
      r.created_at
    FROM public.community_comment_reports r
    ON CONFLICT DO NOTHING;
  END IF;
END $mig2$;

-- ─── 4. Drop old dismiss RPCs (replaced below) ─────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_dismiss_community_post_report(UUID);
DROP FUNCTION IF EXISTS public.admin_dismiss_community_comment_report(UUID);

-- ─── 5. New unified admin RPCs ─────────────────────────────────────────────────

-- Dismiss a content report without deleting the content
CREATE OR REPLACE FUNCTION public.admin_dismiss_content_report(p_report_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  UPDATE public.content_reports SET status = 'dismissed' WHERE id = p_report_id;
  INSERT INTO public.admin_audit_logs (action_type, target_type, target_id, actor_id, details)
  VALUES ('dismiss_content_report', 'content_report', p_report_id, auth.uid(), '{}');
END;
$$;

-- Remove a reported community post (delete post + mark all its reports as actioned)
CREATE OR REPLACE FUNCTION public.admin_remove_reported_post(p_report_id UUID, p_post_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  DELETE FROM public.community_posts WHERE id = p_post_id;
  UPDATE public.content_reports
    SET status = 'actioned'
    WHERE content_type = 'community_post' AND content_id = p_post_id;
  INSERT INTO public.admin_audit_logs (action_type, target_type, target_id, actor_id, details)
  VALUES ('delete_community_post', 'community_post', p_post_id, auth.uid(),
          jsonb_build_object('report_id', p_report_id));
END;
$$;

-- Remove a reported community comment
CREATE OR REPLACE FUNCTION public.admin_remove_reported_comment(p_report_id UUID, p_comment_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  DELETE FROM public.community_comments WHERE id = p_comment_id;
  UPDATE public.content_reports
    SET status = 'actioned'
    WHERE content_type = 'community_comment' AND content_id = p_comment_id;
  INSERT INTO public.admin_audit_logs (action_type, target_type, target_id, actor_id, details)
  VALUES ('delete_community_comment', 'community_comment', p_comment_id, auth.uid(),
          jsonb_build_object('report_id', p_report_id));
END;
$$;

-- Takedown a reported service (sets is_available=false, does not delete)
CREATE OR REPLACE FUNCTION public.admin_remove_reported_service(p_report_id UUID, p_service_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  UPDATE public.services SET is_available = false WHERE id = p_service_id;
  UPDATE public.content_reports
    SET status = 'actioned'
    WHERE content_type = 'service' AND content_id = p_service_id;
  INSERT INTO public.admin_audit_logs (action_type, target_type, target_id, actor_id, details)
  VALUES ('takedown_service', 'service', p_service_id, auth.uid(),
          jsonb_build_object('report_id', p_report_id));
END;
$$;

-- Remove a reported secondhand listing
CREATE OR REPLACE FUNCTION public.admin_remove_reported_secondhand(p_report_id UUID, p_item_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  DELETE FROM public.secondhand WHERE id = p_item_id;
  UPDATE public.content_reports
    SET status = 'actioned'
    WHERE content_type = 'secondhand' AND content_id = p_item_id;
  INSERT INTO public.admin_audit_logs (action_type, target_type, target_id, actor_id, details)
  VALUES ('delete_secondhand', 'secondhand', p_item_id, auth.uid(),
          jsonb_build_object('report_id', p_report_id));
END;
$$;

-- ─── 6. Drop legacy tables ─────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.community_post_reports;
DROP TABLE IF EXISTS public.community_comment_reports;
