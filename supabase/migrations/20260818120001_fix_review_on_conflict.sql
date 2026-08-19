-- 修复:提交评价报 "there is no unique or exclusion constraint matching the ON CONFLICT specification"。
-- 根因:uq_reviews_order_dir 是「部分唯一索引」(WHERE order_id IS NOT NULL),但 submit_review /
-- reveal_stale_reviews 的 ON CONFLICT (order_id, direction) 没带同样的 WHERE 谓词,Postgres 无法
-- 匹配部分索引作为冲突仲裁。给两处 ON CONFLICT 补上 WHERE order_id IS NOT NULL。

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
    v_dir := 'provider_to_client'; v_ratee := o.client_id;  v_prov := NULL;
  ELSE
    RAISE EXCEPTION '无权评价此成交';
  END IF;

  INSERT INTO public.reviews (service_id, provider_id, ratee_id, reviewer_id, direction, rating, comment, tags, order_id, revealed_at)
    VALUES (o.service_id, v_prov, v_ratee, v_uid, v_dir, p_rating,
            NULLIF(btrim(coalesce(p_comment,'')),''), p_tags, p_order_id, NULL)
  ON CONFLICT (order_id, direction) WHERE order_id IS NOT NULL DO UPDATE
     SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, tags = EXCLUDED.tags
  RETURNING id INTO v_review;

  SELECT EXISTS(SELECT 1 FROM public.reviews WHERE order_id = p_order_id AND direction <> v_dir) INTO v_other;
  IF v_other THEN
    UPDATE public.reviews SET revealed_at = now() WHERE order_id = p_order_id AND revealed_at IS NULL;
  END IF;
  RETURN v_review;
END $$;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, int, text, text[]) TO authenticated;

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
  ON CONFLICT (order_id, direction) WHERE order_id IS NOT NULL DO NOTHING;

  UPDATE public.reviews r SET revealed_at = now()
  FROM public.orders o
  WHERE r.order_id = o.id AND r.revealed_at IS NULL
    AND COALESCE(o.completed_at, o.confirmed_at, o.created_at) < now() - interval '48 hours';
END $$;
