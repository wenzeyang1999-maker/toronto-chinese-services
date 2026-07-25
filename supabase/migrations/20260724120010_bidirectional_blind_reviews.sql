-- ─── 华邻信用及评分体系 V2 · 一期 ──────────────────────────────────────────────
-- 1) 双向盲评：师傅也能评客户；未公开的评价被评人看不到（防报复）
-- 2) 48h 自动好评 + 双方都评即公开
-- 3) 近 30 单加权评分 + 客户可信度粗档位（供师傅抢单前参考）
-- 平台不经手支付：所有加扣分只用可核实信号；此处只做评价侧。

-- ── 1) reviews 扩展：被评对象/方向/标签/公开时间/是否系统默认 ──────────────────
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS ratee_id    uuid REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS direction   text,
  ADD COLUMN IF NOT EXISTS tags        text[],
  ADD COLUMN IF NOT EXISTS revealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_auto     boolean NOT NULL DEFAULT false;

-- 回填历史（都是客户评师傅，且早已公开）
UPDATE public.reviews
   SET ratee_id    = provider_id,
       direction   = 'client_to_provider',
       revealed_at = COALESCE(revealed_at, created_at)
 WHERE direction IS NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_ratee ON public.reviews(ratee_id, direction);

-- 一单一方向一评（替换旧的一单一评）
DROP INDEX IF EXISTS uq_reviews_order;
CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_order_dir
  ON public.reviews(order_id, direction) WHERE order_id IS NOT NULL;

-- ── 2) 盲评 RLS：未公开评价只有评价人本人/管理员可见（被评人看不到）──────────────
DROP POLICY IF EXISTS "anyone can read reviews" ON public.reviews;
CREATE POLICY "read revealed or own reviews" ON public.reviews FOR SELECT
  USING (revealed_at IS NOT NULL OR reviewer_id = auth.uid() OR public.is_admin());

-- ── 3) submit_review：支持双向；插入为隐藏，双方都评则立即互相公开 ────────────────
CREATE OR REPLACE FUNCTION public.submit_review(
  p_order_id uuid, p_rating int, p_comment text, p_tags text[] DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); o public.orders%ROWTYPE;
        v_dir text; v_ratee uuid; v_prov uuid; v_review uuid; v_other boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '未登录'; END IF;
  IF p_rating < 1 OR p_rating > 5 THEN RAISE EXCEPTION '请选择 1-5 星'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF o.id IS NULL THEN RAISE EXCEPTION '订单不存在'; END IF;
  IF o.status NOT IN ('confirmed','completed') THEN RAISE EXCEPTION '成交确认后才能评价'; END IF;

  IF v_uid = o.client_id THEN
    v_dir := 'client_to_provider'; v_ratee := o.provider_id; v_prov := o.provider_id;
  ELSIF v_uid = o.provider_id THEN
    v_dir := 'provider_to_client'; v_ratee := o.client_id;  v_prov := NULL;  -- provider_id 仅用于"师傅被评"聚合
  ELSE
    RAISE EXCEPTION '无权评价此成交';
  END IF;

  INSERT INTO public.reviews (service_id, provider_id, ratee_id, reviewer_id, direction, rating, comment, tags, order_id, revealed_at)
    VALUES (o.service_id, v_prov, v_ratee, v_uid, v_dir, p_rating,
            NULLIF(btrim(coalesce(p_comment,'')),''), p_tags, p_order_id, NULL)
  ON CONFLICT (order_id, direction) DO UPDATE
     SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, tags = EXCLUDED.tags
  RETURNING id INTO v_review;

  SELECT EXISTS(SELECT 1 FROM public.reviews WHERE order_id = p_order_id AND direction <> v_dir) INTO v_other;
  IF v_other THEN
    UPDATE public.reviews SET revealed_at = now() WHERE order_id = p_order_id AND revealed_at IS NULL;
  END IF;
  RETURN v_review;
END $$;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, int, text, text[]) TO authenticated;

-- ── 4) 48h 自动好评 + 公开 ─────────────────────────────────────────────────────
-- 仅对"已有一方评价"的订单，给缺评方补默认 5★（避免给双方都没评的订单造假数据），
-- 然后公开所有过 48h 仍隐藏的评价。
CREATE OR REPLACE FUNCTION public.reveal_stale_reviews() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.reviews (service_id, provider_id, ratee_id, reviewer_id, direction, rating, order_id, revealed_at, is_auto)
  SELECT o.service_id,
         CASE WHEN d.dir='client_to_provider' THEN o.provider_id ELSE NULL END,
         CASE WHEN d.dir='client_to_provider' THEN o.provider_id ELSE o.client_id END,
         CASE WHEN d.dir='client_to_provider' THEN o.client_id  ELSE o.provider_id END,
         d.dir, 5, o.id, now(), true
  FROM public.orders o
  CROSS JOIN (VALUES ('client_to_provider'),('provider_to_client')) AS d(dir)
  WHERE o.status IN ('confirmed','completed')
    AND COALESCE(o.completed_at, o.confirmed_at, o.created_at) < now() - interval '48 hours'
    AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.order_id=o.id AND r.direction=d.dir)
    AND EXISTS     (SELECT 1 FROM public.reviews r WHERE r.order_id=o.id AND r.direction<>d.dir)
  ON CONFLICT (order_id, direction) DO NOTHING;

  UPDATE public.reviews r SET revealed_at = now()
  FROM public.orders o
  WHERE r.order_id = o.id AND r.revealed_at IS NULL
    AND COALESCE(o.completed_at, o.confirmed_at, o.created_at) < now() - interval '48 hours';
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reveal-stale-reviews') THEN
    PERFORM cron.unschedule('reveal-stale-reviews');
  END IF;
  PERFORM cron.schedule('reveal-stale-reviews', '7 * * * *', $c$SELECT public.reveal_stale_reviews();$c$);
END $$;

-- ── 5) 近 30 单加权评分（越近权重越高）+ 计数 ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_rating(p_user uuid, p_direction text)
RETURNS TABLE(avg_rating numeric, review_count int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH recent AS (
    SELECT rating, row_number() OVER (ORDER BY created_at DESC) AS rn
    FROM public.reviews
    WHERE ratee_id = p_user AND direction = p_direction AND revealed_at IS NOT NULL
    ORDER BY created_at DESC LIMIT 30
  )
  SELECT COALESCE(round(sum(rating*(31-rn))::numeric / NULLIF(sum(31-rn),0), 2), 0) AS avg_rating,
         COUNT(*)::int AS review_count
  FROM recent;
$$;
GRANT EXECUTE ON FUNCTION public.user_rating(uuid, text) TO authenticated, anon;

-- ── 6) 客户可信度粗档位（师傅抢单前参考；只给聚合，不泄露单条评价）──────────────
CREATE OR REPLACE FUNCTION public.client_trust(p_client uuid)
RETURNS TABLE(avg_rating numeric, review_count int, tier text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE a numeric; c int;
BEGIN
  SELECT ur.avg_rating, ur.review_count INTO a, c FROM public.user_rating(p_client, 'provider_to_client') ur;
  RETURN QUERY SELECT a, c,
    CASE WHEN c = 0     THEN 'new'
         WHEN a < 3.5   THEN 'caution'
         WHEN a >= 4.3  THEN 'good'
         ELSE 'ok' END;
END $$;
GRANT EXECUTE ON FUNCTION public.client_trust(uuid) TO authenticated, anon;
