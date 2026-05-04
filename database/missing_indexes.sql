-- missing_indexes.sql
-- Adds indexes that are missing from the initial schema.
-- All statements are idempotent (IF NOT EXISTS).

-- Service list: filters by category + availability on every page load
CREATE INDEX IF NOT EXISTS idx_services_cat_avail
  ON public.services(category_id, is_available);

-- Community feed: sorted by created_at DESC on every load
CREATE INDEX IF NOT EXISTS idx_community_posts_created
  ON public.community_posts(created_at DESC);

-- Chat history: sequential scan per conversation without this
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON public.messages(conversation_id, created_at);

-- Web push: lookup on login/logout does full scan without this
CREATE INDEX IF NOT EXISTS idx_push_subs_user
  ON public.push_subscriptions(user_id);

-- Referral code lookup: unique constraint exists but explicit index may be missing
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code
  ON public.users(referral_code);

-- Content reports: admin queue filters by status on every load
CREATE INDEX IF NOT EXISTS idx_content_reports_status_created
  ON public.content_reports(status, created_at DESC);
