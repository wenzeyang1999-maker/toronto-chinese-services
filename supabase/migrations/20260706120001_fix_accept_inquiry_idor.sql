-- ─── SECURITY (Critical / C1): lock down accept_inquiry (IDOR → PII harvest) ──
-- accept_inquiry was SECURITY DEFINER + GRANT to authenticated but NEVER checked
-- that p_provider_id = auth.uid(), nor that the caller is a real provider for
-- the inquiry's category. Combined with the SELECT policy
-- (owner OR auth.uid() = ANY(accepted_provider_ids)), ANY logged-in user could
-- call accept_inquiry(<any id>, <own uid>), insert themselves, and then read the
-- customer's phone/wechat/name/lat/lng — scriptable full-site PII harvest, plus
-- DoS of the 5 real slots.
--
-- Fix: ignore the passed p_provider_id and always use auth.uid(); require the
-- caller to actually offer that category (a matching available service).
-- Signature kept so the existing frontend call (accept_inquiry(id, uid)) works.

CREATE OR REPLACE FUNCTION accept_inquiry(p_inquiry_id uuid, p_provider_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_accepted  uuid[];
  v_category  text;
  v_new_count int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Lock the row; also grab the category to verify eligibility.
  SELECT accepted_provider_ids, category_id
    INTO v_accepted, v_category
    FROM inquiries
   WHERE id = p_inquiry_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- The caller may only add THEMSELVES, and only if they actually offer this
  -- category (have an available service in it). p_provider_id is ignored.
  IF NOT EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.provider_id = v_uid
      AND s.category_id = v_category
      AND s.is_available = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_eligible');
  END IF;

  IF v_uid = ANY(v_accepted) THEN
    RETURN jsonb_build_object('ok', true, 'already_accepted', true, 'count', array_length(v_accepted, 1));
  END IF;

  IF COALESCE(array_length(v_accepted, 1), 0) >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'full');
  END IF;

  v_accepted  := array_append(v_accepted, v_uid);
  v_new_count := array_length(v_accepted, 1);

  UPDATE inquiries
     SET accepted_provider_ids = v_accepted,
         race_status = CASE WHEN v_new_count >= 5 THEN 'filled' ELSE 'open' END
   WHERE id = p_inquiry_id;

  RETURN jsonb_build_object('ok', true, 'count', v_new_count);
END;
$$;
