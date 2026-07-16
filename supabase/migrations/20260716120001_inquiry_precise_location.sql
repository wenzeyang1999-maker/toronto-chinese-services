-- ─── B7: 录用后才对中选师傅开放精确门牌地址 ─────────────────────────────────────
-- 说明书 §4.4：发单/抢单期不暴露精确经纬度门牌，师傅只见模糊行政区域；客户【确认
-- 录用】后，系统才向被录用的这一位师傅开放精确地址。
-- 做法：inquiries.lat/lng 存「模糊」坐标（供抢单期粗略距离/匹配展示，全体抢单师傅
-- 可读）；新增 precise_lat/precise_lng 存「精确」坐标，对所有 client 角色撤销读取，
-- 仅 owner 或 assigned_provider_id 可经下方 RPC 取得。

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS precise_lat double precision,
  ADD COLUMN IF NOT EXISTS precise_lng double precision;

-- 精确坐标不对任何 client 角色开放（service_role 与下方 SECURITY DEFINER RPC 例外）
REVOKE SELECT (precise_lat) ON public.inquiries FROM authenticated, anon;
REVOKE SELECT (precise_lng) ON public.inquiries FROM authenticated, anon;

-- RPC：精确位置仅 owner 或「已录用」师傅可取
CREATE OR REPLACE FUNCTION public.get_inquiry_location(p_inquiry_id uuid)
RETURNS TABLE(lat double precision, lng double precision)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); i public.inquiries%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT * INTO i FROM public.inquiries WHERE id = p_inquiry_id;
  IF i.id IS NULL THEN RETURN; END IF;
  -- 仅发单客户本人，或已被【确认录用】的这一位师傅
  IF v_uid <> i.user_id AND v_uid IS DISTINCT FROM i.assigned_provider_id THEN RETURN; END IF;
  RETURN QUERY SELECT i.precise_lat, i.precise_lng;
END $$;
GRANT EXECUTE ON FUNCTION public.get_inquiry_location(uuid) TO authenticated;
