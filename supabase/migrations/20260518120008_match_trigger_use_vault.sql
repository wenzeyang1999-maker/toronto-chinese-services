-- ─── Swap trigger to read secrets from Supabase Vault ────────────────────────
-- The original 20260518120007 migration tried to read from
-- current_setting('app.service_role_key'), which requires ALTER DATABASE —
-- not allowed on Supabase managed databases. Re-create the trigger to read
-- the secrets from Vault (supabase_vault) instead.
--
-- ⚠ One-time setup required (run manually in SQL editor):
--   SELECT vault.create_secret(
--     'https://suvjhtiglecjgcnzdgfo.supabase.co', 'tcs_supabase_url');
--   SELECT vault.create_secret(
--     'YOUR_SERVICE_ROLE_JWT_HERE', 'tcs_service_role_key');

CREATE EXTENSION IF NOT EXISTS supabase_vault;

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
  -- Read secrets from Vault. If unset we silently return so inserts succeed.
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'tcs_supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'tcs_service_role_key' LIMIT 1;
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
  WHERE u.id <> NEW.user_id
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
    RAISE WARNING 'notify_matched_providers_on_request failed: %', SQLERRM;
    RETURN NEW;
END;
$$;
