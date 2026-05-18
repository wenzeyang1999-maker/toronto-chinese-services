-- ─── Services soft-delete ────────────────────────────────────────────────────
-- Prevents hard-deletes that would cascade into reviews/saves loss and
-- break referenced conversations. Hard-delete API path is removed; clients
-- must use the new soft_delete_service RPC.

-- 1. Add deleted_at column
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_services_deleted_at
  ON public.services(deleted_at) WHERE deleted_at IS NULL;

-- 2. Drop the existing DELETE RLS policy — no direct deletes allowed
DROP POLICY IF EXISTS "providers can delete own services" ON public.services;

-- 3. Update the "anyone can read" policy to exclude soft-deleted rows
DROP POLICY IF EXISTS "anyone can read available services" ON public.services;
CREATE POLICY "anyone can read available services"
  ON public.services FOR SELECT
  USING (is_available = true AND deleted_at IS NULL);

-- 4. Soft-delete RPC — provider-owned or admin
CREATE OR REPLACE FUNCTION public.soft_delete_service(p_service_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_role  TEXT;
BEGIN
  SELECT provider_id INTO v_owner FROM services WHERE id = p_service_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'service not found';
  END IF;

  SELECT role INTO v_role FROM users WHERE id = auth.uid();

  IF v_owner <> auth.uid() AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE services
  SET deleted_at = NOW(),
      is_available = false
  WHERE id = p_service_id;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_service(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_service(UUID) TO authenticated;
