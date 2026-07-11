-- ─── FIX: get_contact / admin_get_user_emails threw 42804 (type mismatch) ────
-- These plpgsql RETURN QUERY functions declare TABLE(... text ...), but the
-- underlying columns are character varying (users.phone varchar(30), email
-- varchar, etc). plpgsql strictly checks the row type, so RETURN QUERY raised
-- "structure of query does not match function result type" and the whole RPC
-- errored → the frontend got null → contact blocks (phone/wechat/email) and the
-- admin email column silently showed nothing since the email 收口. Cast the
-- selected columns to text so they match the declared return types.

CREATE OR REPLACE FUNCTION public.get_contact(p_target uuid)
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
  RETURN QUERY
    SELECT u.phone::text, u.wechat::text, u.email::text
      FROM public.users u WHERE u.id = p_target;
END $$;
GRANT EXECUTE ON FUNCTION public.get_contact(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_user_emails(p_ids uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RETURN; END IF;
  RETURN QUERY
    SELECT u.id, u.email::text FROM public.users u WHERE u.id = ANY(p_ids);
END $$;
REVOKE ALL ON FUNCTION public.admin_get_user_emails(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_user_emails(uuid[]) TO authenticated;
