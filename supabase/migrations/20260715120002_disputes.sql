-- ─── A2: 纠纷工单 + AI 初步意见（人工终判）─────────────────────────────────────
-- 说明书 §5.2 AI 仲裁：一方对成交/完工订单发起纠纷 → 后台开一张工单 → AI 调取
-- 订单要素 + 双方聊天记录 + 完工存证照，给出「初步参考意见」（非约束）→ admin
-- 有空时人工终判。注意：ToS 明确平台不担保、不结算，故本功能仅为参考 + 人工处理。

CREATE TABLE IF NOT EXISTS public.disputes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  raised_by   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  against_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason      text NOT NULL,
  status      text NOT NULL DEFAULT 'open'
              CHECK (status IN ('open','reviewing','resolved','dismissed')),
  ai_opinion  text,                    -- AI 初步意见（Edge Function 回填）
  resolution  text,                    -- admin 终判说明
  created_at  timestamptz DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_disputes_status  ON public.disputes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_order    ON public.disputes(order_id);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
-- 双方当事人可读自己的纠纷；admin 全读。写入全走下方 RPC（无 INSERT/UPDATE 策略）。
DROP POLICY IF EXISTS "parties read own disputes" ON public.disputes;
CREATE POLICY "parties read own disputes" ON public.disputes FOR SELECT
  USING (auth.uid() = raised_by OR auth.uid() = against_id OR public.is_admin());

-- ── RPC: 发起纠纷（订单任一方，confirmed/completed 订单）──────────────────────
CREATE OR REPLACE FUNCTION public.raise_dispute(p_order_id uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); o public.orders%ROWTYPE; v_against uuid; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '未登录'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION '请填写纠纷原因'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF o.id IS NULL THEN RAISE EXCEPTION '订单不存在'; END IF;
  IF v_uid <> o.client_id AND v_uid <> o.provider_id THEN RAISE EXCEPTION '无权对此订单发起纠纷'; END IF;
  IF o.status NOT IN ('confirmed','completed') THEN RAISE EXCEPTION '仅成交/完工订单可发起纠纷'; END IF;
  IF EXISTS (SELECT 1 FROM public.disputes WHERE order_id = p_order_id AND status IN ('open','reviewing')) THEN
    RAISE EXCEPTION '该订单已有进行中的纠纷';
  END IF;

  v_against := CASE WHEN v_uid = o.client_id THEN o.provider_id ELSE o.client_id END;
  INSERT INTO public.disputes (order_id, raised_by, against_id, reason)
    VALUES (p_order_id, v_uid, v_against, btrim(p_reason))
    RETURNING id INTO v_id;

  -- 通知所有 admin：后台开了一张纠纷工单
  INSERT INTO public.notifications (recipient_id, type, title, body, link_url)
    SELECT u.id, 'dispute_new', '新纠纷待处理',
           '有用户对一笔成交发起纠纷，请到后台「纠纷」查看', '/admin'
      FROM public.users u WHERE u.role = 'admin';
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.raise_dispute(uuid, text) TO authenticated;

-- ── RPC: AI 意见回填（仅 service_role / Edge Function 调用）────────────────────
CREATE OR REPLACE FUNCTION public.set_dispute_ai_opinion(p_dispute_id uuid, p_opinion text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.disputes
     SET ai_opinion = p_opinion,
         status = CASE WHEN status = 'open' THEN 'reviewing' ELSE status END
   WHERE id = p_dispute_id;
END $$;
REVOKE ALL ON FUNCTION public.set_dispute_ai_opinion(uuid, text) FROM PUBLIC;
-- 仅 service_role 可执行（Edge Function 用 service key，绕过；不 GRANT 给 authenticated）。

-- ── RPC: admin 取纠纷完整上下文（订单 + 双方 + 完工照 + 聊天记录）──────────────
CREATE OR REPLACE FUNCTION public.admin_dispute_context(p_dispute_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE d public.disputes%ROWTYPE; o public.orders%ROWTYPE; v_conv uuid; v_chat jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO d FROM public.disputes WHERE id = p_dispute_id;
  IF d.id IS NULL THEN RAISE EXCEPTION '纠纷不存在'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = d.order_id;

  SELECT id INTO v_conv FROM public.conversations
   WHERE client_id = o.client_id AND provider_id = o.provider_id
     AND (service_id = o.service_id OR (service_id IS NULL AND o.service_id IS NULL))
   ORDER BY created_at LIMIT 1;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'sender_id', m.sender_id, 'content', m.content, 'at', m.created_at
         ) ORDER BY m.created_at), '[]'::jsonb)
    INTO v_chat FROM public.messages m WHERE m.conversation_id = v_conv;

  RETURN jsonb_build_object(
    'order', jsonb_build_object(
      'title', o.title, 'amount', o.amount, 'category_id', o.category_id,
      'status', o.status, 'completion_photos', o.completion_photos,
      'created_at', o.created_at, 'completed_at', o.completed_at),
    'client_id', o.client_id, 'provider_id', o.provider_id,
    'client_name',   (SELECT name FROM public.users WHERE id = o.client_id),
    'provider_name', (SELECT name FROM public.users WHERE id = o.provider_id),
    'raised_by', d.raised_by,
    'chat', v_chat
  );
END $$;
REVOKE ALL ON FUNCTION public.admin_dispute_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dispute_context(uuid) TO authenticated;

-- ── RPC: admin 终判 ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
  p_dispute_id uuid, p_status text, p_resolution text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.disputes%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('resolved','dismissed') THEN RAISE EXCEPTION '状态非法'; END IF;
  SELECT * INTO d FROM public.disputes WHERE id = p_dispute_id;
  IF d.id IS NULL THEN RAISE EXCEPTION '纠纷不存在'; END IF;

  UPDATE public.disputes
     SET status = p_status, resolution = NULLIF(btrim(coalesce(p_resolution,'')),''),
         resolved_at = now()
   WHERE id = p_dispute_id;

  -- 通知双方处理结果
  INSERT INTO public.notifications (recipient_id, type, title, body, link_url)
    SELECT uid, 'dispute_resolved', '纠纷已处理',
           CASE WHEN p_status = 'resolved' THEN '平台已对您的纠纷作出处理' ELSE '您的纠纷已被关闭' END,
           '/profile?section=orders'
      FROM (VALUES (d.raised_by), (d.against_id)) AS t(uid);
END $$;
REVOKE ALL ON FUNCTION public.admin_resolve_dispute(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(uuid, text, text) TO authenticated;
