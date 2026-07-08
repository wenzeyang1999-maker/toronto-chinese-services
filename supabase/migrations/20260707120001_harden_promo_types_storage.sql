-- ─── Round 2 hardening: promo days cap / service_types / storage / whitelist ──

-- 1) use_free_promotion(p_days) had NO upper bound → a member could pass
--    p_days=100000 and pin is_promoted for centuries, defeating the paid-extend
--    model. Clamp to 1–7 days. (Body otherwise identical to 20260630120001.)
CREATE OR REPLACE FUNCTION public.use_free_promotion(p_service_id uuid, p_days int DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_level text;
  v_quota int;
  v_used  int;
BEGIN
  p_days := least(greatest(coalesce(p_days, 3), 1), 7);   -- clamp 1–7 days

  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '未登录'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.services WHERE id = p_service_id AND provider_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', '无权操作此服务');
  END IF;

  SELECT membership_level INTO v_level FROM public.users WHERE id = v_uid;
  v_quota := public.free_promo_quota(v_level);
  IF v_quota = 0 THEN RETURN jsonb_build_object('ok', false, 'error', '仅黄金/至尊会员可用'); END IF;

  SELECT count(*) INTO v_used FROM public.free_promo_usage
    WHERE provider_id = v_uid AND created_at >= date_trunc('month', now());
  IF v_used >= v_quota THEN
    RETURN jsonb_build_object('ok', false, 'error', '本月免费置顶额度已用完');
  END IF;

  UPDATE public.services
     SET is_promoted = true, promoted_until = now() + make_interval(days => p_days)
   WHERE id = p_service_id AND provider_id = v_uid;
  INSERT INTO public.free_promo_usage (provider_id, service_id) VALUES (v_uid, p_service_id);

  RETURN jsonb_build_object('ok', true, 'remaining', v_quota - v_used - 1, 'days', p_days);
END;
$$;
GRANT EXECUTE ON FUNCTION public.use_free_promotion(uuid, int) TO authenticated;

-- 2) service_types was INSERT WITH CHECK(true) + UPDATE USING(true) → any user
--    could pollute/rewrite the shared taxonomy or inflate usage_count to pin a
--    custom name to the top of the picker. The app only ever INSERTs a crowd
--    type (usage_count=1, ON CONFLICT DO NOTHING) — it never UPDATEs. So:
--    constrain the INSERT, and lock UPDATE to admins.
DROP POLICY IF EXISTS "authenticated users can insert service types" ON public.service_types;
CREATE POLICY "authenticated can add a crowd type"
  ON public.service_types FOR INSERT TO authenticated
  WITH CHECK (
    usage_count = 1
    AND category_id IS NOT NULL
    AND char_length(name) BETWEEN 1 AND 80
  );

DROP POLICY IF EXISTS "authenticated users can update usage count" ON public.service_types;
CREATE POLICY "only admin can update service types"
  ON public.service_types FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3) Storage owner check was `auth.uid() = ANY(foldername)` — uid anywhere in the
--    path passed, so `{victim}/{attacker}/file` (attacker's uid in segment 2)
--    let an attacker drop files under a victim's top-level prefix. Require the
--    uid to be segment 1, OR segment 2 under a known non-uid prefix. All real
--    upload paths are `{uid}/…` or `{prefix}/{uid}/…`.
DROP POLICY IF EXISTS "own folder upload" ON storage.objects;
CREATE POLICY "own folder upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] IN
        ('realestate', 'qualifications', 'events', 'chat-photos', 'community', 'secondhand')
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
  );

-- 4) row_is_promoted(p_table,...) took an arbitrary table name (format %I already
--    blocks injection, but callers could probe table existence). Whitelist the
--    five tables that actually carry is_promoted.
CREATE OR REPLACE FUNCTION public.row_is_promoted(p_table text, p_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE v boolean;
BEGIN
  IF p_table NOT IN ('services', 'jobs', 'events', 'properties', 'secondhand') THEN
    RAISE EXCEPTION 'row_is_promoted: unsupported table %', p_table;
  END IF;
  EXECUTE format('SELECT is_promoted FROM public.%I WHERE id = $1', p_table)
    INTO v USING p_id;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.row_is_promoted(text, uuid) TO authenticated, anon;
