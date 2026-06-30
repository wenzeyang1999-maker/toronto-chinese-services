-- Fix stale membership tier copy (2026-06-29)
--
-- The 20260525120001 migration left L2/L3 taglines describing the OLD rule
-- ("邀请 3 人送 / 邀请 10 人送 30 天"). The live referral rule (trigger
-- 20260531130001) is: every 10 referrals → +30 days of L2 (cumulative);
-- L3 is admin-granted only, never earned by referrals.
--
-- Align the membership_tiers copy that MembershipSection reads (tagline / price_note).

UPDATE public.membership_tiers SET
  tagline    = '每邀请 10 位好友注册即可获得',
  price_note = '每邀请 10 人送 1 个月（可累计叠加）'
WHERE level = 'L2';

UPDATE public.membership_tiers SET
  tagline    = '仅向特别贡献用户开放',
  price_note = '管理员授予 / 联系洽谈置顶推广'
WHERE level = 'L3';
