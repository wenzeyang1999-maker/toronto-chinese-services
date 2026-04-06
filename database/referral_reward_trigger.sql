-- ─── Referral Reward Trigger ──────────────────────────────────────────────────
-- 规则：每累计 10 人通过你的分享码注册，自动给你续 30 天会员
--   · L1 用户 → 升级到 L2 + 30 天
--   · L2 / L3 用户 → 保持等级，到期时间 +30 天
-- 触发时机：AFTER INSERT ON public.users（新用户注册后立即计算）
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION reward_referrer_on_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  referrer       RECORD;
  ref_count      INTEGER;
  new_expiry     TIMESTAMPTZ;
BEGIN
  -- 没有填邀请码，跳过
  IF NEW.referred_by_code IS NULL THEN
    RETURN NEW;
  END IF;

  -- 找到推荐人
  SELECT id, membership_level, membership_expires_at
  INTO referrer
  FROM public.users
  WHERE referral_code = NEW.referred_by_code;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- 统计该码已邀请人数（含本次新用户，因为是 AFTER INSERT）
  SELECT COUNT(*) INTO ref_count
  FROM public.users
  WHERE referred_by_code = NEW.referred_by_code;

  -- 每达到 10 的倍数就奖励一次
  IF ref_count % 10 = 0 THEN
    -- 计算新到期时间：从当前到期时间续，若已过期则从现在起算
    IF referrer.membership_expires_at IS NOT NULL
       AND referrer.membership_expires_at > now() THEN
      new_expiry := referrer.membership_expires_at + interval '30 days';
    ELSE
      new_expiry := now() + interval '30 days';
    END IF;

    UPDATE public.users
    SET
      -- L1 用户顺带升级到 L2，L2/L3 保持不变
      membership_level = CASE
        WHEN membership_level = 'L1' THEN 'L2'
        ELSE membership_level
      END,
      membership_expires_at = new_expiry
    WHERE id = referrer.id;

  END IF;

  RETURN NEW;
END;
$$;

-- 先删旧版本（如果有），再创建
DROP TRIGGER IF EXISTS trg_referral_reward ON public.users;

CREATE TRIGGER trg_referral_reward
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION reward_referrer_on_signup();
