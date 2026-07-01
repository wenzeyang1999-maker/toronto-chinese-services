-- Free promotion quota for paid members (方案A 曝光优先, 2026-06-30)
--
-- L2 黄金 gets 1 free promotion / month, L3 至尊 gets 3. A promotion floats the
-- service to the top (is_promoted). Expiry is handled WITHOUT cron: we stamp
-- promoted_until, and reads treat a promotion as inactive once it passes.
--
-- Admin-granted promotions keep promoted_until = NULL (never auto-expire).

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS promoted_until timestamptz;

-- One row per free promotion used — lets us count monthly usage per provider.
CREATE TABLE IF NOT EXISTS public.free_promo_usage (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  service_id  uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_free_promo_usage_provider_month
  ON public.free_promo_usage (provider_id, created_at);

-- Access is only ever through the SECURITY DEFINER RPCs below.
ALTER TABLE public.free_promo_usage ENABLE ROW LEVEL SECURITY;

-- Monthly quota by tier.
CREATE OR REPLACE FUNCTION public.free_promo_quota(p_level text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_level WHEN 'L3' THEN 3 WHEN 'L2' THEN 1 ELSE 0 END;
$$;

-- How many free promotions the caller has left this calendar month.
CREATE OR REPLACE FUNCTION public.my_free_promo_remaining()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_level text;
  v_used  int;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  SELECT membership_level INTO v_level FROM public.users WHERE id = v_uid;
  SELECT count(*) INTO v_used FROM public.free_promo_usage
    WHERE provider_id = v_uid AND created_at >= date_trunc('month', now());
  RETURN greatest(0, public.free_promo_quota(v_level) - v_used);
END;
$$;
GRANT EXECUTE ON FUNCTION public.my_free_promo_remaining() TO authenticated;

-- Spend one free promotion on a service the caller owns.
CREATE OR REPLACE FUNCTION public.use_free_promotion(p_service_id uuid, p_days int DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_level text;
  v_quota int;
  v_used  int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '未登录'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.services WHERE id = p_service_id AND provider_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', '无权操作此服务');
  END IF;

  SELECT membership_level INTO v_level FROM public.users WHERE id = v_uid;
  v_quota := public.free_promo_quota(v_level);
  IF v_quota = 0 THEN RETURN jsonb_build_object('ok', false, 'error', '仅黄金/至尊会员可用'); END IF;

  SELECT count(*) INTO v_used FROM public.free_promo_usage
    WHERE provider_id = v_uid AND created_at >= date_trunc('month', now());
  IF v_used >= v_quota THEN
    RETURN jsonb_build_object('ok', false, 'error', '本月免费置顶额度已用完');
  END IF;

  UPDATE public.services
     SET is_promoted = true, promoted_until = now() + make_interval(days => p_days)
   WHERE id = p_service_id AND provider_id = v_uid;
  INSERT INTO public.free_promo_usage (provider_id, service_id) VALUES (v_uid, p_service_id);

  RETURN jsonb_build_object('ok', true, 'remaining', v_quota - v_used - 1, 'days', p_days);
END;
$$;
GRANT EXECUTE ON FUNCTION public.use_free_promotion(uuid, int) TO authenticated;
