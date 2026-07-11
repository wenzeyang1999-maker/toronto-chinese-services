-- Service business hours — free-text (e.g. "周一至周五 9:00-18:00,周末休息"). Shown
-- on the service detail page. Structured hours + "营业中" filter are a later step.
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS business_hours text;
