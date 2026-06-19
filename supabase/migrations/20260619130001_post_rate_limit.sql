-- Anti-spam: per-user insert rate limits on user-generated content.
-- A generic BEFORE INSERT trigger counts how many rows the row's owner has
-- created in the same table within a sliding window and rejects the insert once
-- the cap is hit. Limits are generous (real users won't hit them); they exist to
-- stop a script/bot from flooding listings, posts, or inquiries.
--
-- Enforced at the DB layer so it can't be bypassed by calling Supabase directly.

CREATE OR REPLACE FUNCTION public.enforce_post_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_owner_col TEXT := TG_ARGV[0];
  v_max       INT  := TG_ARGV[1]::int;
  v_window    INT  := TG_ARGV[2]::int;   -- minutes
  v_owner     UUID;
  v_count     INT;
BEGIN
  -- Pull the owner id out of NEW dynamically (works for any owner column name).
  v_owner := (to_jsonb(NEW) ->> v_owner_col)::uuid;

  -- Anonymous / system rows (no owner) are not rate-limited here.
  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  EXECUTE format(
    'SELECT count(*) FROM public.%I WHERE %I = $1 AND created_at > now() - ($2 || '' minutes'')::interval',
    TG_TABLE_NAME, v_owner_col
  ) INTO v_count USING v_owner, v_window;

  IF v_count >= v_max THEN
    RAISE EXCEPTION '操作过于频繁：% 分钟内最多创建 % 条，请稍后再试', v_window, v_max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Attach to each user-generated-content table with its owner column + caps.
-- Listings: 10 per 10 min. Inquiries fan out emails to many providers, so tighter: 5 per 10 min.
DROP TRIGGER IF EXISTS trg_rate_limit_services ON public.services;
CREATE TRIGGER trg_rate_limit_services BEFORE INSERT ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.enforce_post_rate_limit('provider_id', '10', '10');

DROP TRIGGER IF EXISTS trg_rate_limit_jobs ON public.jobs;
CREATE TRIGGER trg_rate_limit_jobs BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_post_rate_limit('poster_id', '10', '10');

DROP TRIGGER IF EXISTS trg_rate_limit_properties ON public.properties;
CREATE TRIGGER trg_rate_limit_properties BEFORE INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.enforce_post_rate_limit('poster_id', '10', '10');

DROP TRIGGER IF EXISTS trg_rate_limit_secondhand ON public.secondhand;
CREATE TRIGGER trg_rate_limit_secondhand BEFORE INSERT ON public.secondhand
  FOR EACH ROW EXECUTE FUNCTION public.enforce_post_rate_limit('seller_id', '10', '10');

DROP TRIGGER IF EXISTS trg_rate_limit_events ON public.events;
CREATE TRIGGER trg_rate_limit_events BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_post_rate_limit('poster_id', '10', '10');

DROP TRIGGER IF EXISTS trg_rate_limit_community_posts ON public.community_posts;
CREATE TRIGGER trg_rate_limit_community_posts BEFORE INSERT ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_post_rate_limit('author_id', '10', '10');

DROP TRIGGER IF EXISTS trg_rate_limit_inquiries ON public.inquiries;
CREATE TRIGGER trg_rate_limit_inquiries BEFORE INSERT ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_post_rate_limit('user_id', '5', '10');
