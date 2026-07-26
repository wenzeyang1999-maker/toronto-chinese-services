-- 管理员：手动设置信用扣分（0-100，可清零/增减）+ 纠纷标记严重
CREATE OR REPLACE FUNCTION public.admin_set_credit_penalty(p_user uuid, p_value int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_value < 0 OR p_value > 100 THEN RAISE EXCEPTION 'penalty 需 0-100'; END IF;
  UPDATE public.users SET credit_penalty = p_value WHERE id = p_user;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_credit_penalty(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_credit_penalty(uuid, int) TO authenticated;

-- admin_resolve_dispute 增加 severe（严重仲裁判负 → 单次即触发受限）
DROP FUNCTION IF EXISTS public.admin_resolve_dispute(uuid, text, text);
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
  p_dispute_id uuid, p_status text, p_resolution text, p_severe boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.disputes%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('resolved','dismissed') THEN RAISE EXCEPTION '状态非法'; END IF;
  SELECT * INTO d FROM public.disputes WHERE id = p_dispute_id;
  IF d.id IS NULL THEN RAISE EXCEPTION '纠纷不存在'; END IF;
  UPDATE public.disputes
     SET status = p_status, resolution = NULLIF(btrim(coalesce(p_resolution,'')),''),
         severe = (p_status = 'resolved' AND p_severe), resolved_at = now()
   WHERE id = p_dispute_id;
  INSERT INTO public.notifications (recipient_id, type, title, body, link_url)
    SELECT uid, 'dispute_resolved', '纠纷已处理',
           CASE WHEN p_status = 'resolved' THEN '平台已对您的纠纷作出处理' ELSE '您的纠纷已被关闭' END,
           '/profile?section=orders'
      FROM (VALUES (d.raised_by), (d.against_id)) AS t(uid);
END $$;
REVOKE ALL ON FUNCTION public.admin_resolve_dispute(uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(uuid, text, text, boolean) TO authenticated;
