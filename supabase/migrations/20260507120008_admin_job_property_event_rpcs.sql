-- Adds admin RPCs to handle reported jobs, properties, and events
-- Also adds admin_stats_trend for 7d/30d overview data

-- Remove a reported job (sets is_active=false)
CREATE OR REPLACE FUNCTION public.admin_remove_reported_job(p_report_id UUID, p_job_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  UPDATE public.jobs SET is_active = false WHERE id = p_job_id;
  UPDATE public.content_reports
    SET status = 'actioned'
    WHERE content_type = 'job' AND content_id = p_job_id;
  INSERT INTO public.admin_audit_logs (action_type, target_type, target_id, actor_id, details)
  VALUES ('takedown_job', 'job', p_job_id, auth.uid(),
          jsonb_build_object('report_id', p_report_id));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_remove_reported_job(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_reported_job(UUID, UUID) TO authenticated;

-- Remove a reported property (sets is_active=false)
CREATE OR REPLACE FUNCTION public.admin_remove_reported_property(p_report_id UUID, p_property_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  UPDATE public.properties SET is_active = false WHERE id = p_property_id;
  UPDATE public.content_reports
    SET status = 'actioned'
    WHERE content_type = 'property' AND content_id = p_property_id;
  INSERT INTO public.admin_audit_logs (action_type, target_type, target_id, actor_id, details)
  VALUES ('takedown_property', 'property', p_property_id, auth.uid(),
          jsonb_build_object('report_id', p_report_id));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_remove_reported_property(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_reported_property(UUID, UUID) TO authenticated;

-- Remove a reported event (sets is_active=false)
CREATE OR REPLACE FUNCTION public.admin_remove_reported_event(p_report_id UUID, p_event_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  UPDATE public.events SET is_active = false WHERE id = p_event_id;
  UPDATE public.content_reports
    SET status = 'actioned'
    WHERE content_type = 'event' AND content_id = p_event_id;
  INSERT INTO public.admin_audit_logs (action_type, target_type, target_id, actor_id, details)
  VALUES ('takedown_event', 'event', p_event_id, auth.uid(),
          jsonb_build_object('report_id', p_report_id));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_remove_reported_event(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_reported_event(UUID, UUID) TO authenticated;

-- Overview trend stats: 7d and 30d new record counts per table
CREATE OR REPLACE FUNCTION public.admin_stats_trend()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN (
    SELECT jsonb_build_object(
      'users_7d',       (SELECT count(*) FROM users      WHERE created_at > now() - interval '7 days'),
      'users_30d',      (SELECT count(*) FROM users      WHERE created_at > now() - interval '30 days'),
      'services_7d',    (SELECT count(*) FROM services   WHERE created_at > now() - interval '7 days'),
      'services_30d',   (SELECT count(*) FROM services   WHERE created_at > now() - interval '30 days'),
      'jobs_7d',        (SELECT count(*) FROM jobs       WHERE created_at > now() - interval '7 days'),
      'jobs_30d',       (SELECT count(*) FROM jobs       WHERE created_at > now() - interval '30 days'),
      'properties_7d',  (SELECT count(*) FROM properties WHERE created_at > now() - interval '7 days'),
      'properties_30d', (SELECT count(*) FROM properties WHERE created_at > now() - interval '30 days'),
      'secondhand_7d',  (SELECT count(*) FROM secondhand WHERE created_at > now() - interval '7 days'),
      'secondhand_30d', (SELECT count(*) FROM secondhand WHERE created_at > now() - interval '30 days'),
      'events_7d',      (SELECT count(*) FROM events     WHERE created_at > now() - interval '7 days'),
      'events_30d',     (SELECT count(*) FROM events     WHERE created_at > now() - interval '30 days')
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_stats_trend() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_stats_trend() TO authenticated;
