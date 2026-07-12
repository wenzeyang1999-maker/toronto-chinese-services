-- ─── 墙1 P2: 评价绑成交(防刷评)────────────────────────────────────────────
-- 评价只能给「双方确认的成交(confirmed 订单)」,且只有客户能评。全部走
-- submit_review RPC(SECURITY DEFINER),关掉客户端直接写。旧评价 order_id 为
-- null(遗留,保留)。

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

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
  IF o.service_id IS NULL THEN RAISE EXCEPTION '此成交无关联服务，无法评价'; END IF;
  BEGIN
    INSERT INTO public.reviews (service_id, reviewer_id, rating, comment, order_id)
      VALUES (o.service_id, v_uid, p_rating, NULLIF(btrim(coalesce(p_comment,'')),''), p_order_id)
      RETURNING id INTO v_review;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION '您已评价过此服务';
  END;
  RETURN v_review;
END $$;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, int, text) TO authenticated;

-- Block direct client inserts — reviews now come only through submit_review
-- (SECURITY DEFINER bypasses RLS). Update/delete-own + admin policies unchanged.
DROP POLICY IF EXISTS "authenticated users can write reviews" ON public.reviews;
