-- ── Feedback / Reports Table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  type        TEXT        NOT NULL CHECK (type IN ('report', 'complaint', 'suggestion')),
  report_type TEXT        CHECK (report_type IN ('user', 'service', 'post')),
  target      TEXT,       -- username / post title / service name
  reason_tag  TEXT,       -- quick-pick tag
  detail      TEXT,       -- free-text explanation
  status      TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can submit
CREATE POLICY "anyone can submit feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (true);

-- Users can only see their own submissions
CREATE POLICY "users view own feedback"
  ON public.feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_status     ON public.feedback (status);
CREATE INDEX IF NOT EXISTS idx_feedback_type       ON public.feedback (type);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback (created_at DESC);
