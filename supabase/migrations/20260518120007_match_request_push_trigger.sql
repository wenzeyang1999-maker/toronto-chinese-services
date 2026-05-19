-- ─── DB trigger: push to matched providers on new service_request ───────────
-- AFTER INSERT on service_requests, find providers whose skill_tags fuzzy-match
-- the new request, then call send-web-push edge function (in broadcast_match
-- mode) via pg_net so each matched provider gets a web push.
--
-- ⚠ One-time setup required (run manually in Supabase SQL editor, NOT in
--   migration, since the values are project-specific secrets):
--
--   ALTER DATABASE postgres
--     SET app.supabase_url = 'https://suvjhtiglecjgcnzdgfo.supabase.co';
--   ALTER DATABASE postgres
--     SET app.service_role_key = 'YOUR_SERVICE_ROLE_JWT_HERE';
--   SELECT pg_reload_conf();
--
-- (Service role key lives in Supabase Dashboard → Settings → API.)

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_matched_providers_on_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_url             TEXT;
  v_key             TEXT;
  v_matched_ids     UUID[];
  v_haystack        TEXT;
  v_body_text       TEXT;
BEGIN
  -- Read configured project URL + service role key from DB settings.
  -- If unconfigured we silently return so inserts still succeed.
  v_url := current_setting('app.supabase_url', true);
  v_key := current_setting('app.service_role_key', true);
  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RETURN NEW;
  END IF;

  -- Fuzzy-match: any provider whose skill_tags contains a token that appears
  -- inside the request's title / description / category.
  v_haystack := lower(
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.category, '')
  );

  SELECT array_agg(DISTINCT u.id)
    INTO v_matched_ids
  FROM users u
  WHERE u.id <> NEW.user_id                       -- don't push to the requester
    AND u.skill_tags IS NOT NULL
    AND array_length(u.skill_tags, 1) > 0
    AND EXISTS (
      SELECT 1
      FROM unnest(u.skill_tags) AS tag
      WHERE tag IS NOT NULL
        AND tag <> ''
        AND v_haystack LIKE '%' || lower(tag) || '%'
    );

  IF v_matched_ids IS NULL OR array_length(v_matched_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  v_body_text := NEW.title;
  IF NEW.area IS NOT NULL AND NEW.area <> '' THEN
    v_body_text := v_body_text || '  ·  ' || NEW.area;
  END IF;

  -- Fire-and-forget HTTP POST to send-web-push edge function.
  -- pg_net is async; we don't wait for the response.
  PERFORM net.http_post(
    url     := v_url || '/functions/v1/send-web-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object(
      'mode',             'broadcast_match',
      'recipientUserIds', to_jsonb(v_matched_ids),
      'title',            '💼 新需求匹配你的标签',
      'body',             v_body_text,
      'url',              '/requests/' || NEW.id,
      'tag',              'req-' || NEW.id
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block the INSERT just because the notification failed
    RAISE WARNING 'notify_matched_providers_on_request failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_requests_notify_matched ON public.service_requests;
CREATE TRIGGER trg_service_requests_notify_matched
  AFTER INSERT ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_matched_providers_on_request();
