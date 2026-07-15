-- ─── A1: 完工存证 — 师傅点完工上传 1-3 张现场照片，订单 confirmed → completed ──
-- 说明书 §5.2：完工照片作为数字化履约存证（纠纷防线），写入订单。这也把订单机
-- 预留的 completed 状态接上转入点（此前只到 confirmed）。存证照片供 A2 的 AI
-- 仲裁调取。

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS completion_photos text[],
  ADD COLUMN IF NOT EXISTS completed_at      timestamptz;

-- ── RPC: 标记完工（仅服务商，confirmed → completed，1-3 张存证照片）──────────────
CREATE OR REPLACE FUNCTION public.complete_order(p_order_id uuid, p_photos text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); o public.orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '未登录'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION '订单不存在'; END IF;
  IF v_uid <> o.provider_id THEN RAISE EXCEPTION '仅服务商可标记完工'; END IF;
  IF o.status <> 'confirmed' THEN RAISE EXCEPTION '仅已成交订单可标记完工'; END IF;
  IF p_photos IS NULL OR array_length(p_photos, 1) IS NULL THEN
    RAISE EXCEPTION '请至少上传 1 张完工照片';
  END IF;
  IF array_length(p_photos, 1) > 3 THEN
    RAISE EXCEPTION '最多 3 张完工照片';
  END IF;

  UPDATE public.orders
     SET status = 'completed', completion_photos = p_photos, completed_at = now(), updated_at = now()
   WHERE id = p_order_id;

  INSERT INTO public.notifications (recipient_id, type, title, body, link_url)
    VALUES (o.client_id, 'order_completed', '服务已完工',
            '服务商已上传完工存证，如满意可前往评价', '/profile?section=orders');
END $$;
GRANT EXECUTE ON FUNCTION public.complete_order(uuid, text[]) TO authenticated;
