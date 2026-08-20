-- 修复「我的交易」同一订单重复显示:create_order(标记成交)没有去重,双方各点一次
-- 或手滑点两次就会生成多条订单。改为:若已存在「进行中(pending/confirmed)」的同
-- 客户+服务商+服务 订单,直接返回它,不再新建(completed/cancelled 后可再建,支持复购)。

CREATE OR REPLACE FUNCTION public.create_order(
  p_conversation_id uuid, p_title text DEFAULT NULL, p_amount numeric DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_client uuid; v_provider uuid; v_service uuid; v_cat text; v_other uuid; v_order uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '未登录'; END IF;
  SELECT client_id, provider_id, service_id INTO v_client, v_provider, v_service
    FROM public.conversations WHERE id = p_conversation_id;
  IF v_client IS NULL THEN RAISE EXCEPTION '会话不存在'; END IF;
  IF v_uid <> v_client AND v_uid <> v_provider THEN RAISE EXCEPTION '无权操作此会话'; END IF;

  -- 去重:已有进行中的成交 → 直接返回,不重复建
  SELECT id INTO v_order FROM public.orders
   WHERE client_id = v_client AND provider_id = v_provider
     AND service_id IS NOT DISTINCT FROM v_service
     AND status IN ('pending','confirmed')
   ORDER BY created_at DESC
   LIMIT 1;
  IF v_order IS NOT NULL THEN
    RETURN v_order;
  END IF;

  SELECT category_id INTO v_cat FROM public.services WHERE id = v_service;
  v_other := CASE WHEN v_uid = v_client THEN v_provider ELSE v_client END;

  INSERT INTO public.orders (client_id, provider_id, service_id, category_id, title, amount, created_by)
    VALUES (v_client, v_provider, v_service, v_cat, NULLIF(btrim(coalesce(p_title,'')),''), p_amount, v_uid)
    RETURNING id INTO v_order;

  INSERT INTO public.notifications (recipient_id, type, title, body, link_url)
    VALUES (v_other, 'order_pending', '有一条成交待确认',
            '对方发起了成交确认，请到「我的订单」确认或拒绝', '/profile?section=orders');
  RETURN v_order;
END $$;
GRANT EXECUTE ON FUNCTION public.create_order(uuid, text, numeric) TO authenticated;
