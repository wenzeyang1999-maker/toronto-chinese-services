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

  DELETE FROM public.community_posts WHERE id = post_id;

  UPDATE public.community_post_reports
  SET status = 'removed'
  WHERE post_id = admin_delete_community_post.post_id
    AND status = 'pending';

  INSERT INTO public.admin_audit_logs(actor_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), 'community_post_deleted', 'community_post', post_id::text, '{}'::jsonb);
END;
$$;


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

  DELETE FROM public.community_comments WHERE id = comment_id;

  UPDATE public.community_comment_reports
  SET status = 'removed'
  WHERE community_comment_reports.comment_id = admin_delete_community_comment.comment_id
    AND status = 'pending';

  INSERT INTO public.admin_audit_logs(actor_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), 'community_comment_report_removed', 'community_comment', comment_id::text,
          jsonb_build_object('post_id', post_id));
END;
$$;


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

  DELETE FROM public.reviews WHERE id = review_id;

  UPDATE public.review_reports
  SET status = 'removed'
  WHERE review_id = admin_remove_review.review_id;

  INSERT INTO public.admin_audit_logs(actor_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), 'review_removed', 'review', review_id::text,
          jsonb_build_object('report_id', report_id));
END;
$$;


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
