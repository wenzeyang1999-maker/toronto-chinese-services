-- ─── Admin Backend Patch ─────────────────────────────────────────────────────
-- Completes missing admin-side RLS permissions for dashboard actions.
-- Safe to run multiple times.
--
-- Notes:
-- 1. This patch intentionally checks table existence before touching policies.
-- 2. It assumes public.users already exists and includes a role column.
-- 3. If a target table has not been created yet, that section is skipped.

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE NOTICE 'Skip admin backend patch: public.users does not exist yet';
    RETURN;
  END IF;
END $$;

-- jobs
DO $$
BEGIN
  IF to_regclass('public.jobs') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'jobs'
        AND policyname = 'admins can manage all jobs'
    ) THEN
      CREATE POLICY "admins can manage all jobs"
        ON public.jobs FOR ALL
        USING (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
  ELSE
    RAISE NOTICE 'Skip policy admins can manage all jobs: public.jobs does not exist yet';
  END IF;
END $$;

-- properties
DO $$
BEGIN
  IF to_regclass('public.properties') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'properties'
        AND policyname = 'admins can manage all properties'
    ) THEN
      CREATE POLICY "admins can manage all properties"
        ON public.properties FOR ALL
        USING (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
  ELSE
    RAISE NOTICE 'Skip policy admins can manage all properties: public.properties does not exist yet';
  END IF;
END $$;

-- secondhand
DO $$
BEGIN
  IF to_regclass('public.secondhand') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'secondhand'
        AND policyname = 'admins can manage all secondhand'
    ) THEN
      CREATE POLICY "admins can manage all secondhand"
        ON public.secondhand FOR ALL
        USING (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
  ELSE
    RAISE NOTICE 'Skip policy admins can manage all secondhand: public.secondhand does not exist yet';
  END IF;
END $$;

-- events
DO $$
BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'events'
        AND policyname = 'admins can manage all events'
    ) THEN
      CREATE POLICY "admins can manage all events"
        ON public.events FOR ALL
        USING (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
  ELSE
    RAISE NOTICE 'Skip policy admins can manage all events: public.events does not exist yet';
  END IF;
END $$;

-- community_posts
DO $$
BEGIN
  IF to_regclass('public.community_posts') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'community_posts'
        AND policyname = 'admins can manage all community posts'
    ) THEN
      CREATE POLICY "admins can manage all community posts"
        ON public.community_posts FOR ALL
        USING (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
  ELSE
    RAISE NOTICE 'Skip policy admins can manage all community posts: public.community_posts does not exist yet';
  END IF;
END $$;

-- community_comments
DO $$
BEGIN
  IF to_regclass('public.community_comments') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'community_comments'
        AND policyname = 'admins can manage all community comments'
    ) THEN
      CREATE POLICY "admins can manage all community comments"
        ON public.community_comments FOR ALL
        USING (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
  ELSE
    RAISE NOTICE 'Skip policy admins can manage all community comments: public.community_comments does not exist yet';
  END IF;
END $$;
