-- Low-priority hardening (2026-06-20)
-- Two small, independent fixes. Both idempotent — safe to run on any DB state.
--
--   1. reviews(reviewer_id) index — speeds up "all reviews by user X" lookups
--      (the reviewer-side query did a sequential scan without it).
--   2. Prevent self-Q&A — a provider must not be able to ask a question on
--      their own service (which they could then "answer" to fake engagement).
--
-- NOTE: 点赞去重 (community like dedup) is intentionally NOT here — it is already
-- enforced by community_likes' PRIMARY KEY (user_id, post_id) + the like_count
-- trigger, and the frontend inserts/deletes rows in that table. Nothing to add.

-- 1. reviews reviewer_id index ------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON public.reviews (reviewer_id);

-- 2. Prevent providers from asking questions on their own service -------------
-- RESTRICTIVE policy: ANDed with the existing permissive INSERT policy, so the
-- asker must (a) be the authenticated user AND (b) not own the target service.
DROP POLICY IF EXISTS "providers cannot ask own service questions" ON public.questions;
CREATE POLICY "providers cannot ask own service questions"
  ON public.questions AS RESTRICTIVE FOR INSERT
  WITH CHECK (
    NOT EXISTS (
      SELECT 1
      FROM public.services s
      WHERE s.id = service_id
        AND s.provider_id = auth.uid()
    )
  );
