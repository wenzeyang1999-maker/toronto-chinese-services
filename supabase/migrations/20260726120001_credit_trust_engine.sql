-- ─── 华邻信用及评分体系 V2 · 二期：信用分 + 综合可信度 + 门槛 ──────────────────
-- 只用可核实信号（认证 / 完工 / 口碑 / 有效投诉），不碰支付、不做 OCR。
-- 精确分仅内部/后台用；对外给粗档位。门槛按老板拍板：≥3 有效投诉→提示；
-- ≥5 有效投诉 或 严重仲裁判负→停止抢单 / 限制发单。

-- 严重仲裁判负标记（默认 false，管理员终判时可置 true）
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS severe boolean NOT NULL DEFAULT false;

-- 综合可信度：一次算出分数 + 档位 + 门槛标志
CREATE OR REPLACE FUNCTION public.user_trust(p_user uuid)
RETURNS TABLE(
  score int, tier text, valid_complaints int,
  warn boolean, restricted boolean, completed int, good_reviews int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  u public.users%ROWTYPE;
  s numeric := 0; v_social int; v_completed int; v_good int; v_vc int; v_severe boolean;
BEGIN
  SELECT * INTO u FROM public.users WHERE id = p_user;
  IF u.id IS NULL THEN
    RETURN QUERY SELECT 0, 'new', 0, false, false, 0, 0; RETURN;
  END IF;

  -- 认证加分
  IF COALESCE(u.phone_verified,false) THEN s := s + 30; END IF;
  IF COALESCE(u.id_verified,false) OR COALESCE(u.business_verified,false) THEN s := s + 12; END IF;
  v_social := LEAST(10, 5 * (
    SELECT count(*) FROM jsonb_object_keys(COALESCE(u.social_links::jsonb, '{}'::jsonb)) AS x(k)
    WHERE x.k <> '_cover'));
  s := s + v_social;
  IF COALESCE(u.has_license,false)   THEN s := s + 12; END IF;
  IF COALESCE(u.has_insurance,false) THEN s := s + 10; END IF;

  -- 履约加分（提高权重；双方确认的完工 + 5★好评）
  SELECT count(*) INTO v_completed FROM public.orders
    WHERE status = 'completed' AND (client_id = p_user OR provider_id = p_user);
  s := s + LEAST(24, v_completed * 2);
  SELECT count(*) INTO v_good FROM public.reviews
    WHERE ratee_id = p_user AND rating = 5 AND revealed_at IS NOT NULL;
  s := s + LEAST(15, v_good * 1);

  -- 扣分（有效投诉 = 仲裁判该用户负；叠加已有 credit_penalty 手动/系统扣分）
  SELECT count(*) INTO v_vc FROM public.disputes
    WHERE against_id = p_user AND status = 'resolved';
  SELECT EXISTS(SELECT 1 FROM public.disputes
    WHERE against_id = p_user AND status = 'resolved' AND severe) INTO v_severe;
  s := s - v_vc * 20 - COALESCE(u.credit_penalty, 0);

  score := GREATEST(0, LEAST(100, s))::int;
  valid_complaints := v_vc;
  completed := v_completed;
  good_reviews := v_good;
  restricted := (v_vc >= 5 OR v_severe);
  warn := (v_vc >= 3 AND NOT restricted);
  tier := CASE
    WHEN restricted THEN 'restricted'
    WHEN v_completed = 0 AND v_vc = 0 THEN 'new'
    WHEN score >= 80 AND v_vc = 0 AND v_completed >= 5 THEN 'good'
    ELSE 'ok' END;
  RETURN NEXT;
END $$;
GRANT EXECUTE ON FUNCTION public.user_trust(uuid) TO authenticated, anon;

-- 后台/内部：只取精确分
CREATE OR REPLACE FUNCTION public.credit_score(p_user uuid) RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT score FROM public.user_trust(p_user);
$$;
GRANT EXECUTE ON FUNCTION public.credit_score(uuid) TO authenticated, anon;

-- 门槛判定：是否允许参与（抢单/发单）
CREATE OR REPLACE FUNCTION public.can_participate(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT restricted FROM public.user_trust(p_user);
$$;
GRANT EXECUTE ON FUNCTION public.can_participate(uuid) TO authenticated, anon;

-- 客户档位升级为综合可信度（一期 client_trust 只用评价；二期改用 user_trust）
CREATE OR REPLACE FUNCTION public.client_trust(p_client uuid)
RETURNS TABLE(avg_rating numeric, review_count int, tier text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t RECORD; r RECORD;
BEGIN
  SELECT * INTO t FROM public.user_trust(p_client);
  SELECT ur.avg_rating, ur.review_count INTO r FROM public.user_rating(p_client, 'provider_to_client') ur;
  RETURN QUERY SELECT COALESCE(r.avg_rating,0), COALESCE(r.review_count,0), t.tier;
END $$;
GRANT EXECUTE ON FUNCTION public.client_trust(uuid) TO authenticated, anon;
