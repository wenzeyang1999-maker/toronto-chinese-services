-- Category service benchmarks (2026-06-29)
--
-- Powers the "对比同类" view in the provider stats panel: for each service
-- category, the platform-wide average views-per-service and average rating.
-- The frontend compares a provider's own per-category averages against these
-- so they can tell whether their listings perform above or below the norm.
--
-- SECURITY DEFINER so it can aggregate across every provider's services, but it
-- returns ONLY anonymous category-level aggregates — no per-provider rows, no PII.

CREATE OR REPLACE FUNCTION public.category_service_benchmarks()
RETURNS TABLE (
  category_id   text,
  service_count int,
  avg_views     numeric,
  avg_rating    numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.category_id,
    COUNT(DISTINCT s.id)::int                       AS service_count,
    AVG(COALESCE(vc.view_count, 0))::numeric        AS avg_views,   -- 0-view services count too
    AVG(rc.avg_rating)::numeric                      AS avg_rating   -- only over rated services
  FROM public.services s
  LEFT JOIN (
    SELECT target_id, COUNT(*)::numeric AS view_count
    FROM public.views
    WHERE target_type = 'service'
    GROUP BY target_id
  ) vc ON vc.target_id = s.id
  LEFT JOIN (
    SELECT service_id, AVG(rating)::numeric AS avg_rating
    FROM public.reviews
    GROUP BY service_id
  ) rc ON rc.service_id = s.id
  WHERE s.is_available = true
  GROUP BY s.category_id;
$$;

GRANT EXECUTE ON FUNCTION public.category_service_benchmarks() TO authenticated;
