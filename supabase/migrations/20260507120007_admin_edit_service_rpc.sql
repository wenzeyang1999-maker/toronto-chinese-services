-- admin_edit_service_rpc.sql
-- Lets admins edit a service's title, description, and price (for moderating
-- policy-violating content without taking the whole service down).
-- Audit log captures the previous values for traceability.

CREATE OR REPLACE FUNCTION public.admin_update_service_content(
  service_id      uuid,
  new_title       text,
  new_description text,
  new_price       numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_title       text;
  prev_description text;
  prev_price       numeric;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT title, description, price
    INTO prev_title, prev_description, prev_price
    FROM public.services WHERE id = service_id;

  IF prev_title IS NULL THEN RAISE EXCEPTION 'service not found'; END IF;

  UPDATE public.services
     SET title       = COALESCE(new_title, title),
         description = COALESCE(new_description, description),
         price       = COALESCE(new_price, price)
   WHERE id = service_id;

  INSERT INTO public.admin_audit_logs(actor_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), 'service_content_updated', 'service', service_id::text,
          jsonb_build_object(
            'prev_title',       prev_title,
            'prev_description', prev_description,
            'prev_price',       prev_price,
            'new_title',        new_title,
            'new_description',  new_description,
            'new_price',        new_price
          ));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_service_content(uuid, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_service_content(uuid, text, text, numeric) TO authenticated;
