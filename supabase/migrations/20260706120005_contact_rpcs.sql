-- ─── SECURITY (H2): contact reveal via authorized RPCs ──────────────────────
-- Any authenticated user could `select phone,wechat from users` and scrape every
-- CUSTOMER's number (merchants publish contact intentionally, customers do not —
-- but they share the same column). Postgres can't mask columns per-row, so we
-- move phone/wechat reads behind SECURITY DEFINER RPCs that enforce WHO may see
-- WHOSE contact, then REVOKE the columns from authenticated (next migration,
-- after the frontend is migrated).

-- Own contact — for form prefill.
CREATE OR REPLACE FUNCTION public.get_my_contact()
RETURNS TABLE(name text, phone text, wechat text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT name, phone, wechat FROM public.users WHERE id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.get_my_contact() TO authenticated;

-- Someone else's contact — allowed only when legitimately reachable:
--   • self, or admin
--   • the target is a PROVIDER (has an available service) → public merchant contact
--   • the caller shares a conversation with the target → conversation partner
-- Returns no rows otherwise.
CREATE OR REPLACE FUNCTION public.get_contact(p_target uuid)
RETURNS TABLE(phone text, wechat text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE v_ok boolean;
BEGIN
  IF auth.uid() IS NULL OR p_target IS NULL THEN RETURN; END IF;
  SELECT
       p_target = auth.uid()
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.services s
                WHERE s.provider_id = p_target AND s.is_available = true)
    OR EXISTS (SELECT 1 FROM public.conversations c
                WHERE (c.client_id = auth.uid()   AND c.provider_id = p_target)
                   OR (c.provider_id = auth.uid() AND c.client_id   = p_target))
  INTO v_ok;
  IF NOT v_ok THEN RETURN; END IF;
  RETURN QUERY SELECT u.phone, u.wechat FROM public.users u WHERE u.id = p_target;
END $$;
GRANT EXECUTE ON FUNCTION public.get_contact(uuid) TO authenticated;
