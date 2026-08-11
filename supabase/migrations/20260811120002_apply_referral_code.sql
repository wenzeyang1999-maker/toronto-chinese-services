-- 内测2-#4(Google 路径):OAuth 登录拿不到 metadata 里的邀请码,只能登录后补写。
-- 但推荐人奖励触发器原本只在 INSERT 触发 → 补写(UPDATE)不发奖励。这里:
--   1) 加 AFTER UPDATE OF referred_by_code 触发器(仅首次由 NULL→非NULL 时)复用 grant_referral_reward
--   2) 提供 apply_referral_code(code) RPC:校验有效码+非自邀+未设过 → 写入(顺带触发奖励)
-- 幂等:已设过 referred_by_code 的账号再调用不生效,避免重复记推荐。

DROP TRIGGER IF EXISTS referral_reward_update_trg ON public.users;
CREATE TRIGGER referral_reward_update_trg
  AFTER UPDATE OF referred_by_code ON public.users
  FOR EACH ROW
  WHEN (OLD.referred_by_code IS NULL AND NEW.referred_by_code IS NOT NULL)
  EXECUTE FUNCTION public.grant_referral_reward();

CREATE OR REPLACE FUNCTION public.apply_referral_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_code     text := upper(NULLIF(trim(COALESCE(p_code, '')), ''));
  v_referrer uuid;
BEGIN
  IF v_uid IS NULL OR v_code IS NULL THEN
    RETURN false;
  END IF;

  -- 已设过邀请码 → 幂等返回(不重复记推荐)
  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_uid AND referred_by_code IS NOT NULL) THEN
    RETURN false;
  END IF;

  -- 邀请码必须有效(匹配某个已存在用户的 referral_code)且不是自己
  SELECT id INTO v_referrer FROM public.users WHERE upper(referral_code) = v_code LIMIT 1;
  IF v_referrer IS NULL OR v_referrer = v_uid THEN
    RETURN false;
  END IF;

  -- 写入(触发 referral_reward_update_trg → 给推荐人发奖励)
  UPDATE public.users SET referred_by_code = v_code
   WHERE id = v_uid AND referred_by_code IS NULL;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_referral_code(text) TO authenticated;
