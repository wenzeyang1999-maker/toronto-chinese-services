-- ─── 5-Person Inquiry Race Mechanic ──────────────────────────────────────────
-- Adds race columns to inquiries and a concurrency-safe RPC for claiming.

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS accepted_provider_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS race_status           text    DEFAULT 'open'
    CHECK (race_status IN ('open', 'filled', 'cancelled'));

-- Atomic claim: provider clicks "抢单".
-- Returns { ok, count, error? }
-- Fails safely if: inquiry not found, already filled, or provider already claimed.
CREATE OR REPLACE FUNCTION accept_inquiry(p_inquiry_id uuid, p_provider_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_accepted   uuid[];
  v_new_count  int;
BEGIN
  -- Lock the row exclusively to prevent concurrent double-claims
  SELECT accepted_provider_ids
    INTO v_accepted
    FROM inquiries
   WHERE id = p_inquiry_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Already accepted by this provider?
  IF p_provider_id = ANY(v_accepted) THEN
    RETURN jsonb_build_object('ok', true, 'already_accepted', true, 'count', array_length(v_accepted, 1));
  END IF;

  -- Slot full?
  IF COALESCE(array_length(v_accepted, 1), 0) >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'full');
  END IF;

  v_accepted  := array_append(v_accepted, p_provider_id);
  v_new_count := array_length(v_accepted, 1);

  UPDATE inquiries
     SET accepted_provider_ids = v_accepted,
         race_status = CASE WHEN v_new_count >= 5 THEN 'filled' ELSE 'open' END
   WHERE id = p_inquiry_id;

  RETURN jsonb_build_object('ok', true, 'count', v_new_count);
END;
$$;

-- Let any authenticated user call this RPC (providers need it)
GRANT EXECUTE ON FUNCTION accept_inquiry(uuid, uuid) TO authenticated;
