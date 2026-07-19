-- ── Allow「寻求合作」feedback type ────────────────────────────────────────────
-- The 联系我们 card (Profile footer) adds a partnership intent alongside the
-- existing report/complaint/suggestion flows. Widen the type CHECK to accept it.
ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_type_check;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_type_check
  CHECK (type IN ('report', 'complaint', 'suggestion', 'partner'));
