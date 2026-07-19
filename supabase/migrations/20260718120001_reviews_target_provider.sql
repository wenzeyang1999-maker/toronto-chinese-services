-- ─── #1(b): 评价指向师傅本人 + #2 completed 也可评价 ──────────────────────────
-- 背景：reviews.service_id NOT NULL，submit_review 拒绝无服务的成交（"此成交无关联
-- 服务，无法评价"），导致询价/抢单主漏斗（会话 service_id=null）全程评不了。
-- 而名片墙(InquiryResultPanel)已按 `reviews.provider_id` 聚合星级 —— 但该列此前
-- 不存在，查询实际 42703 报错、名片墙星级恒 0。
-- 本迁移补齐既定设计：评价锚定「师傅(provider_id)」，服务(service_id)降为可选上下文。

-- 1) 加 provider_id（评价真正对象=师傅），service_id 改选填
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ALTER COLUMN service_id DROP NOT NULL;

-- 2) 回填历史评价的 provider_id（从服务归属的师傅）
UPDATE public.reviews r
   SET provider_id = s.provider_id
  FROM public.services s
 WHERE r.service_id = s.id AND r.provider_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_provider ON public.reviews(provider_id);

-- 3) 一单一评：订单级去重（询价单 service_id 为空，旧的 (service_id,reviewer_id)
--    唯一约束对空服务无效，改由 order_id 兜底）
CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_order
  ON public.reviews(order_id) WHERE order_id IS NOT NULL;

-- 4) 重写 submit_review：锚定 provider_id，去掉"无关联服务"拦截，confirmed/completed 皆可
CREATE OR REPLACE FUNCTION public.submit_review(p_order_id uuid, p_rating int, p_comment text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); o public.orders%ROWTYPE; v_review uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '未登录'; END IF;
  IF p_rating < 1 OR p_rating > 5 THEN RAISE EXCEPTION '请选择 1-5 星'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF o.id IS NULL THEN RAISE EXCEPTION '订单不存在'; END IF;
  IF v_uid <> o.client_id THEN RAISE EXCEPTION '只有客户可评价此成交'; END IF;
  IF o.status NOT IN ('confirmed','completed') THEN RAISE EXCEPTION '成交确认后才能评价'; END IF;
  BEGIN
    INSERT INTO public.reviews (service_id, provider_id, reviewer_id, rating, comment, order_id)
      VALUES (o.service_id, o.provider_id, v_uid, p_rating,
              NULLIF(btrim(coalesce(p_comment,'')),''), p_order_id)
      RETURNING id INTO v_review;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION '此成交已评价';
  END;
  RETURN v_review;
END $$;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, int, text) TO authenticated;
