-- ─── DB Constraints Patch ─────────────────────────────────────────────────────
-- Adds two missing safety constraints:
--   1. conversations: prevent self-conversations (client_id = provider_id)
--   2. services: block negative / absurd price values
--
-- Note: messages table has only sender_id + conversation_id (no recipient_id).
-- The self-message guard belongs on conversations instead.

-- 1. Self-conversation guard on conversations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'conversations'
      AND constraint_name = 'conversations_no_self_chat'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_no_self_chat CHECK (client_id <> provider_id);
  END IF;
END $$;

-- 2. Price range guard on services
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'services'
      AND constraint_name = 'services_price_range'
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_price_range
        CHECK (price IS NULL OR (price >= 0 AND price <= 100000));
  END IF;
END $$;
