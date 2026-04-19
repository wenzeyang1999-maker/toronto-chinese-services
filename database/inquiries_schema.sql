-- ─── Inquiries + Inquiry Matches ──────────────────────────────────────────────
-- "获取报价" feature: users post a need, system matches & emails providers.
-- inquiry_matches records which providers were notified for each inquiry.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── inquiries ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inquiries (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID,                          -- null = anonymous visitor
  category_id VARCHAR(30)   NOT NULL,
  description TEXT          NOT NULL,
  budget      VARCHAR(100),
  timing      VARCHAR(20)   DEFAULT 'flexible'
              CHECK (timing IN ('asap', 'flexible', 'next_week')),
  name        VARCHAR(100)  NOT NULL,
  phone       VARCHAR(30)   NOT NULL,
  wechat      VARCHAR(100),
  status      VARCHAR(20)   DEFAULT 'open'
              CHECK (status IN ('open', 'matched', 'closed')),
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_category ON inquiries (category_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status   ON inquiries (status);
CREATE INDEX IF NOT EXISTS idx_inquiries_user     ON inquiries (user_id);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "anyone can insert inquiries"
    ON inquiries FOR INSERT TO public WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "users can read own inquiries"
    ON inquiries FOR SELECT TO public USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admins can manage all inquiries"
    ON inquiries FOR ALL TO public
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── inquiry_matches ───────────────────────────────────────────────────────────
-- Records which providers were matched & emailed for each inquiry.
CREATE TABLE IF NOT EXISTS inquiry_matches (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id     UUID        REFERENCES inquiries(id) ON DELETE CASCADE,
  provider_id    UUID,
  provider_name  TEXT        NOT NULL,
  provider_email TEXT        NOT NULL,
  email_sent     BOOLEAN     DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_matches_inquiry ON inquiry_matches (inquiry_id);

ALTER TABLE inquiry_matches ENABLE ROW LEVEL SECURITY;

-- inquiry_matches should only be written by server-side code using service_role.
DO $$ BEGIN
  CREATE POLICY "service role can insert inquiry_matches"
    ON inquiry_matches FOR INSERT TO service_role
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admins can manage inquiry_matches"
    ON inquiry_matches FOR ALL TO public
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
