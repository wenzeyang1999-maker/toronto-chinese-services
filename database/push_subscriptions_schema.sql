-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Web Push Subscriptions Schema
-- Stores per-device subscription endpoints so the server can send push.
-- Safe to run multiple times.
-- Requires: users table already exists.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT         NOT NULL,
  p256dh      TEXT         NOT NULL,  -- subscription public key
  auth        TEXT         NOT NULL,  -- subscription auth secret
  user_agent  TEXT,

  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- A device's endpoint is unique per user (re-subscribing replaces it)
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscriptions
DROP POLICY IF EXISTS "push_subs_select_own" ON push_subscriptions;
CREATE POLICY "push_subs_select_own"
  ON push_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own subscription
DROP POLICY IF EXISTS "push_subs_insert_own" ON push_subscriptions;
CREATE POLICY "push_subs_insert_own"
  ON push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update / delete their own subscription
DROP POLICY IF EXISTS "push_subs_update_own" ON push_subscriptions;
CREATE POLICY "push_subs_update_own"
  ON push_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subs_delete_own" ON push_subscriptions;
CREATE POLICY "push_subs_delete_own"
  ON push_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ENDPOINT DEDUPE TRIGGER
-- A web push endpoint is browser/device-scoped, not user-scoped. If a different
-- user signed in on the same browser and re-subscribed, two rows would point
-- to the same endpoint and the previous user could receive notifications meant
-- for the new owner. This trigger atomically removes any foreign-user rows
-- for the endpoint when one is inserted or updated. SECURITY DEFINER bypasses
-- RLS so it can clean up rows the calling user doesn't own.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION push_subs_endpoint_dedupe()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM push_subscriptions
   WHERE endpoint = NEW.endpoint
     AND id != NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_subs_endpoint_dedupe_trg ON push_subscriptions;
CREATE TRIGGER push_subs_endpoint_dedupe_trg
  AFTER INSERT OR UPDATE OF endpoint ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION push_subs_endpoint_dedupe();
