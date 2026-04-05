-- ─── Review Replies RLS Patch ────────────────────────────────────────────────
-- Fix: only the service provider may reply to a review on their own service.
-- Previous policy allowed any authenticated user to insert a reply.
-- Safe to run multiple times (DROP IF EXISTS + DO $$ guard).
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the old permissive insert policy
DROP POLICY IF EXISTS "users can insert own reply" ON review_replies;

-- Recreate with provider-ownership check
DO $$ BEGIN
  CREATE POLICY "users can insert own reply"
    ON review_replies FOR INSERT
    WITH CHECK (
      auth.uid() IS NOT NULL
      AND replier_id = auth.uid()
      AND review_id IN (
        SELECT r.id
        FROM   reviews  r
        JOIN   services s ON s.id = r.service_id
        WHERE  s.provider_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
