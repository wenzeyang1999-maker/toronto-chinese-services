-- Update membership tier descriptions to reflect actual pricing model:
-- L1: free forever
-- L2: earned by referrals (3 referrals = 30 days)
-- L3: earned by referrals (10 referrals = 30 days) OR contact owner for promoted listing
UPDATE public.membership_tiers SET
  tagline    = '注册即享，永久免费',
  price_note = '永久免费'
WHERE level = 'L1';

UPDATE public.membership_tiers SET
  tagline    = '邀请 3 位好友注册即可获得',
  price_note = '邀请 3 人送 30 天'
WHERE level = 'L2';

UPDATE public.membership_tiers SET
  tagline    = '邀请 10 位好友注册即可获得',
  price_note = '邀请 10 人送 30 天'
WHERE level = 'L3';
