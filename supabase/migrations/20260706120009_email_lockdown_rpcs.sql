-- ─── SECURITY (email 收口, part 1/2): authorized email reads via RPC ─────────
-- authenticated holds SELECT(email) on public.users AND public_profiles exposes
-- email → any logged-in user (or anon via the view) can scrape every user's
-- email, customers included. Same class as the phone/wechat H2 fix. Move the two
-- legitimate email consumers behind RPCs, then (part 2) drop email from the view
-- and REVOKE the column.
--
-- Consumer 1 — public merchant email shown on service/provider pages: fold into
--   get_contact (already authorized: self / admin / provider / conversation).
-- Consumer 2 — admin console (5 surfaces): a bulk id→email lookup, admin-only.

-- get_contact now also returns email. DROP+CREATE because the return signature
-- changes (CREATE OR REPLACE can't alter a function's TABLE columns).
DROP FUNCTION IF EXISTS public.get_contact(uuid);
CREATE FUNCTION public.get_contact(p_target uuid)
RETURNS TABLE(phone text, wechat text, email text)
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
  RETURN QUERY SELECT u.phone, u.wechat, u.email FROM public.users u WHERE u.id = p_target;
END $$;
GRANT EXECUTE ON FUNCTION public.get_contact(uuid) TO authenticated;

-- Admin-only bulk email lookup for the console. Returns nothing for non-admins,
-- so it is not a scrape vector even though it takes an id array.
CREATE OR REPLACE FUNCTION public.admin_get_user_emails(p_ids uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RETURN; END IF;
  RETURN QUERY
    SELECT u.id, u.email FROM public.users u WHERE u.id = ANY(p_ids);
END $$;
REVOKE ALL ON FUNCTION public.admin_get_user_emails(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_user_emails(uuid[]) TO authenticated;
