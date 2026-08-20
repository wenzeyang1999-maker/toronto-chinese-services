-- 「我的交易」删除功能:
-- 1) 我发的需求(inquiries):允许 owner 删除自己的需求(此前只能「关闭」)。
-- 2) 成交订单(orders):两方共享记录不宜硬删(牵连评价/纠纷/对方视图),改为「按人隐藏」——
--    只从本人列表移除,不影响对方;可用于清理历史/重复订单。

-- 1) inquiries owner 可删
DROP POLICY IF EXISTS "owner can delete own inquiries" ON public.inquiries;
CREATE POLICY "owner can delete own inquiries" ON public.inquiries
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2) orders 按人隐藏
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_hidden   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS provider_hidden boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.hide_order(p_order_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); o public.orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '未登录'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF o.id IS NULL THEN RETURN; END IF;
  IF    v_uid = o.client_id   THEN UPDATE public.orders SET client_hidden   = true WHERE id = p_order_id;
  ELSIF v_uid = o.provider_id THEN UPDATE public.orders SET provider_hidden = true WHERE id = p_order_id;
  ELSE  RAISE EXCEPTION '无权操作此订单';
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.hide_order(uuid) TO authenticated;
