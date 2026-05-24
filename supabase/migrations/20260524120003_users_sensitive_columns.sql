-- ─── users: column-level restriction on sensitive contact info ─────────────────
-- Anonymous browsers don't need provider phone / email / wechat to see service
-- cards — they only need name/avatar. Restricting these three columns at the
-- column-grant level stops anonymous PII scraping while keeping the public
-- read policy intact for everything else.
--
-- Effect:
--   anon role     → can SELECT all users columns EXCEPT phone, email, wechat
--   authenticated → unchanged (still sees everything via the existing policy)
--
-- Client queries that join `users` from an anonymous path must NOT request
-- phone / email / wechat or they will fail with "permission denied for column".

REVOKE SELECT ON public.users FROM anon;

GRANT SELECT (
  id,
  name,
  avatar_url,
  social_links,
  is_email_verified,
  phone_verified,
  role,
  created_at,
  updated_at
) ON public.users TO anon;

-- Re-grant safe columns that were added by later migrations. Each is wrapped
-- so the migration doesn't fail if a column doesn't exist in a given
-- environment.
DO $$
DECLARE col TEXT;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'bio', 'last_seen_at', 'is_online', 'online_lat', 'online_lng',
    'skill_tags', 'languages', 'business_name', 'business_address',
    'business_hours', 'verification_status', 'qualification_images',
    'qualification_note', 'membership_level', 'membership_expires_at',
    'referral_code', 'referred_by',
    'rating_avg', 'reviews_count', 'follower_count', 'following_count'
  ] LOOP
    BEGIN
      EXECUTE format('GRANT SELECT (%I) ON public.users TO anon', col);
    EXCEPTION WHEN undefined_column THEN
      -- column doesn't exist in this DB — skip
      NULL;
    END;
  END LOOP;
END $$;
