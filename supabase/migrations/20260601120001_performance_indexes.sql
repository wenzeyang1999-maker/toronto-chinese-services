-- Performance indexes for high-frequency query patterns
--
-- 1. services: category browsing + availability filter (Home, Category pages)
-- 2. community_posts: chronological feed (CommunityPage)
-- 3. messages: conversation thread loading (ConversationPage)
-- 4. push_subscriptions: per-user subscription lookup (notification delivery)

CREATE INDEX IF NOT EXISTS idx_services_category_available
  ON public.services (category_id, is_available);

CREATE INDEX IF NOT EXISTS idx_community_posts_created_at
  ON public.community_posts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions (user_id);
