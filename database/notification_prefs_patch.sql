-- notification_prefs_patch.sql
-- Adds per-user notification preference column to users table.
-- Prefs are stored as JSONB so new event types can be added without schema changes.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB
  NOT NULL DEFAULT '{"messages":true,"inquiry_match":true,"review":true,"platform":true}'::jsonb;
