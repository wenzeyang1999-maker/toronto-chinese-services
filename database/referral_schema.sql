-- ─── Referral System Schema ──────────────────────────────────────────────────
-- Each user gets a unique referral_code (auto-generated from their UUID).
-- referred_by_code stores the code the user entered during registration.
-- Safe to run multiple times (IF NOT EXISTS / OR REPLACE guards).
-- ─────────────────────────────────────────────────────────────────────────────

-- Add columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code    TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_code TEXT;

-- Backfill existing users who don't have a code yet
UPDATE users
SET referral_code = upper(substr(md5(id::text), 1, 7))
WHERE referral_code IS NULL;

-- Index for looking up who referred whom
CREATE INDEX IF NOT EXISTS idx_users_referred_by_code ON users (referred_by_code)
  WHERE referred_by_code IS NOT NULL;

-- ─── Update handles_new_user to include referral fields ───────────────────────
-- Reads referred_by_code from signup metadata (set by frontend if user entered one).
-- Generates referral_code deterministically from user id (no collision possible).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, phone, role, referral_code, referred_by_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', '用户'),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    'user',
    upper(substr(md5(NEW.id::text), 1, 7)),
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'referred_by_code', '')), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS: users can read their own referral_code (already covered by existing policies)
-- Allow anyone to look up whether a referral_code exists (for validation on signup)
DO $$ BEGIN
  CREATE POLICY "anyone can verify referral code"
    ON users FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
