-- ─── RLS Security Patch ──────────────────────────────────────────────────────
-- Fixes 4 vulnerabilities found in RLS audit (2026-04-04):
--
--  1. Users could set role='admin' on themselves (privilege escalation)
--  2. Users could set business_verified=true (bypass admin verification)
--  3. Providers could set is_promoted=true on own listings (bypass payment)
--  4. Providers could review their own services (fake review inflation)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1 & 2: users table ───────────────────────────────────────────────────────
-- Drop old permissive policy, replace with one that blocks sensitive columns.
-- WITH CHECK ensures the new row cannot escalate role or self-approve verification.

DROP POLICY IF EXISTS "users can update own profile" ON public.users;

DO $$ BEGIN
  CREATE POLICY "users can update own profile"
    ON public.users FOR UPDATE
    USING  (auth.uid() = id)
    WITH CHECK (
      auth.uid() = id
      AND role IN ('user', 'provider')          -- cannot self-escalate to admin
      AND business_verified = (
        SELECT business_verified FROM public.users WHERE id = auth.uid()
      )                                          -- cannot self-approve verification
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Admin override: admins can update any user (role, business_verified, etc.)
DO $$ BEGIN
  CREATE POLICY "admins can update any user"
    ON public.users FOR UPDATE
    USING (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── 3a: services — providers cannot self-promote ──────────────────────────────
DROP POLICY IF EXISTS "providers can update own services" ON public.services;

DO $$ BEGIN
  CREATE POLICY "providers can update own services"
    ON public.services FOR UPDATE
    USING  (auth.uid() = provider_id)
    WITH CHECK (
      auth.uid() = provider_id
      AND is_promoted = (
        SELECT is_promoted FROM public.services WHERE id = services.id
      )                                          -- cannot flip is_promoted themselves
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3b: jobs ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "poster can update own jobs" ON public.jobs;

DO $$ BEGIN
  CREATE POLICY "poster can update own jobs"
    ON public.jobs FOR UPDATE
    USING  (auth.uid() = poster_id)
    WITH CHECK (
      auth.uid() = poster_id
      AND is_promoted = (SELECT is_promoted FROM public.jobs WHERE id = jobs.id)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3c: properties ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "poster can update own properties" ON public.properties;

DO $$ BEGIN
  CREATE POLICY "poster can update own properties"
    ON public.properties FOR UPDATE
    USING  (auth.uid() = poster_id)
    WITH CHECK (
      auth.uid() = poster_id
      AND is_promoted = (SELECT is_promoted FROM public.properties WHERE id = properties.id)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3d: secondhand ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "seller can update own listings" ON public.secondhand;

DO $$ BEGIN
  CREATE POLICY "seller can update own listings"
    ON public.secondhand FOR UPDATE
    USING  (auth.uid() = seller_id)
    WITH CHECK (
      auth.uid() = seller_id
      AND is_promoted = (SELECT is_promoted FROM public.secondhand WHERE id = secondhand.id)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3e: events ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "poster can update own events" ON public.events;

DO $$ BEGIN
  CREATE POLICY "poster can update own events"
    ON public.events FOR UPDATE
    USING  (auth.uid() = poster_id)
    WITH CHECK (
      auth.uid() = poster_id
      AND is_promoted = (SELECT is_promoted FROM public.events WHERE id = events.id)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── 4: reviews — cannot review own service ───────────────────────────────────
DROP POLICY IF EXISTS "authenticated users can write reviews" ON public.reviews;

DO $$ BEGIN
  CREATE POLICY "authenticated users can write reviews"
    ON public.reviews FOR INSERT
    WITH CHECK (
      auth.uid() = reviewer_id
      AND service_id NOT IN (
        SELECT id FROM public.services WHERE provider_id = auth.uid()
      )                                          -- cannot review own service
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
