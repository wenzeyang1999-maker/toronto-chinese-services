-- ─────────────────────────────────────────────────────────────────────────────
-- TCS — Verification Migration
-- Adds id_verified + business_verified columns to users table.
-- Safe to run multiple times (IF NOT EXISTS / DO $$ guards).
-- ─────────────────────────────────────────────────────────────────────────────

-- Add id_verified column (实名认证)
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_verified BOOLEAN NOT NULL DEFAULT false;

-- Add business_verified column (商户认证)
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_verified BOOLEAN NOT NULL DEFAULT false;

-- Add verification_doc_url to store the uploaded file path
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_doc_url TEXT;

-- Add verification_status: 'none' | 'pending' | 'approved' | 'rejected'
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'none';

-- Index for admin queue (pending reviews)
CREATE INDEX IF NOT EXISTS idx_users_verification_status ON users (verification_status)
  WHERE verification_status = 'pending';
