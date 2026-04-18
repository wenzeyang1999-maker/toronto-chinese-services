-- ─── Community Reports + Admin Audit Logs ───────────────────────────────────
-- Adds:
--  1. community_post_reports  : users can report community posts
--  2. admin_audit_logs        : admin-side operation trail
--  3. notifications           : in-app reminders for admins/users
-- Safe to run multiple times.

-- ── community_post_reports ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_post_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID       NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  reporter_id  UUID       NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason       VARCHAR(50) NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (post_id, reporter_id),

  CONSTRAINT community_post_reports_reason_check CHECK (
    reason IN ('irrelevant', 'malicious', 'fake', 'spam', 'other')
  ),
  CONSTRAINT community_post_reports_status_check CHECK (
    status IN ('pending', 'dismissed', 'removed')
  )
);

CREATE INDEX IF NOT EXISTS idx_community_post_reports_post_id
  ON public.community_post_reports (post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_reports_reporter_id
  ON public.community_post_reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_community_post_reports_status
  ON public.community_post_reports (status);

ALTER TABLE public.community_post_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_post_reports'
      AND policyname = 'users can read own community reports'
  ) THEN
    CREATE POLICY "users can read own community reports"
      ON public.community_post_reports FOR SELECT
      USING (reporter_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_post_reports'
      AND policyname = 'users can insert community report'
  ) THEN
    CREATE POLICY "users can insert community report"
      ON public.community_post_reports FOR INSERT
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND reporter_id = auth.uid()
        AND NOT EXISTS (
          SELECT 1
          FROM public.community_posts p
          WHERE p.id = post_id
            AND p.author_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_post_reports'
      AND policyname = 'admins can manage community post reports'
  ) THEN
    CREATE POLICY "admins can manage community post reports"
      ON public.community_post_reports FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- ── notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,
  title          TEXT NOT NULL,
  body           TEXT,
  link_url       TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created_at
  ON public.notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at
  ON public.notifications (read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON public.notifications (type);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'users can read own notifications'
  ) THEN
    CREATE POLICY "users can read own notifications"
      ON public.notifications FOR SELECT
      USING (recipient_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'users can update own notifications'
  ) THEN
    CREATE POLICY "users can update own notifications"
      ON public.notifications FOR UPDATE
      USING (recipient_id = auth.uid())
      WITH CHECK (recipient_id = auth.uid());
  END IF;
END $$;

-- ── admin_audit_logs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID       NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action_type   TEXT       NOT NULL,
  target_type   TEXT       NOT NULL,
  target_id     TEXT,
  details       JSONB      NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_id
  ON public.admin_audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target
  ON public.admin_audit_logs (target_type, target_id);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_audit_logs'
      AND policyname = 'admins can read audit logs'
  ) THEN
    CREATE POLICY "admins can read audit logs"
      ON public.admin_audit_logs FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- ── community_comment_reports ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_comment_reports (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id    UUID        NOT NULL REFERENCES public.community_comments(id) ON DELETE CASCADE,
  reporter_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason        VARCHAR(50) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (comment_id, reporter_id),

  CONSTRAINT community_comment_reports_reason_check CHECK (
    reason IN ('irrelevant', 'malicious', 'fake', 'spam', 'other')
  ),
  CONSTRAINT community_comment_reports_status_check CHECK (
    status IN ('pending', 'dismissed', 'removed')
  )
);

CREATE INDEX IF NOT EXISTS idx_community_comment_reports_comment_id
  ON public.community_comment_reports (comment_id);
CREATE INDEX IF NOT EXISTS idx_community_comment_reports_reporter_id
  ON public.community_comment_reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_community_comment_reports_status
  ON public.community_comment_reports (status);

ALTER TABLE public.community_comment_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_comment_reports'
      AND policyname = 'users can read own community comment reports'
  ) THEN
    CREATE POLICY "users can read own community comment reports"
      ON public.community_comment_reports FOR SELECT
      USING (reporter_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_comment_reports'
      AND policyname = 'users can insert community comment report'
  ) THEN
    CREATE POLICY "users can insert community comment report"
      ON public.community_comment_reports FOR INSERT
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND reporter_id = auth.uid()
        AND NOT EXISTS (
          SELECT 1
          FROM public.community_comments c
          WHERE c.id = comment_id
            AND c.author_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_comment_reports'
      AND policyname = 'admins can manage community comment reports'
  ) THEN
    CREATE POLICY "admins can manage community comment reports"
      ON public.community_comment_reports FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_audit_logs'
      AND policyname = 'admins can insert audit logs'
  ) THEN
    CREATE POLICY "admins can insert audit logs"
      ON public.admin_audit_logs FOR INSERT
      WITH CHECK (
        actor_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;
