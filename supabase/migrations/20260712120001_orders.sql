-- ─── 墙1: 订单/成交状态机(P1)──────────────────────────────────────────────
-- 双向确认:一方在会话里「标记成交」→ 生成 pending 订单 → 对方确认 → confirmed。
-- 评价暂不绑定(P2);金额选填(GMV 地基)。

CREATE TABLE IF NOT EXISTS public.orders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  service_id   uuid REFERENCES public.services(id) ON DELETE SET NULL,
  category_id  text,
  title        text,
  amount       numeric,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','confirmed','cancelled','completed')),
  created_by   uuid NOT NULL,
  note         text,
  confirmed_at timestamptz,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  CONSTRAINT orders_no_self CHECK (client_id <> provider_id)
);
CREATE INDEX IF NOT EXISTS idx_orders_client   ON public.orders(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_provider ON public.orders(provider_id, created_at DESC);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Read: only the two parties (admin via is_admin). Writes go through RPCs below.
DROP POLICY IF EXISTS "parties can read own orders" ON public.orders;
CREATE POLICY "parties can read own orders" ON public.orders FOR SELECT
  USING (auth.uid() = client_id OR auth.uid() = provider_id OR public.is_admin());

-- ── RPC: 标记成交(从会话发起)──────────────────────────────────────────────
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

-- ── RPC: 确认成交(对方确认)────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_order(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); o public.orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '未登录'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION '订单不存在'; END IF;
  IF v_uid <> o.client_id AND v_uid <> o.provider_id THEN RAISE EXCEPTION '无权操作'; END IF;
  IF v_uid = o.created_by THEN RAISE EXCEPTION '需由对方确认'; END IF;
  IF o.status <> 'pending' THEN RAISE EXCEPTION '订单状态不可确认'; END IF;

  UPDATE public.orders SET status = 'confirmed', confirmed_at = now(), updated_at = now()
    WHERE id = p_order_id;
  INSERT INTO public.notifications (recipient_id, type, title, body, link_url)
    VALUES (o.created_by, 'order_confirmed', '成交已确认',
            '对方已确认成交 ✓', '/profile?section=orders');
END $$;
GRANT EXECUTE ON FUNCTION public.confirm_order(uuid) TO authenticated;

-- ── RPC: 取消/拒绝(pending 时任一方可取消)──────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); o public.orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '未登录'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION '订单不存在'; END IF;
  IF v_uid <> o.client_id AND v_uid <> o.provider_id THEN RAISE EXCEPTION '无权操作'; END IF;
  IF o.status <> 'pending' THEN RAISE EXCEPTION '仅待确认订单可取消'; END IF;
  UPDATE public.orders SET status = 'cancelled', updated_at = now() WHERE id = p_order_id;
END $$;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO authenticated;

-- ── 商家战绩:公开的"已成交 N 单"(SECURITY DEFINER,绕过订单 RLS 只回计数)──
CREATE OR REPLACE FUNCTION public.provider_order_count(p_provider uuid)
RETURNS int LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT count(*)::int FROM public.orders
   WHERE provider_id = p_provider AND status IN ('confirmed','completed')
$$;
GRANT EXECUTE ON FUNCTION public.provider_order_count(uuid) TO authenticated, anon;
