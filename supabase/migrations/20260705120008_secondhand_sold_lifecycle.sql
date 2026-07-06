-- ─── Secondhand "sold" lifecycle ─────────────────────────────────────────────
-- Mark-as-sold should keep the post VISIBLE with a 「已售出」 badge for a week,
-- then auto-delete it — instead of hiding it immediately.

-- When it was marked sold (drives the 7-day auto-delete).
ALTER TABLE public.secondhand ADD COLUMN IF NOT EXISTS sold_at timestamptz;

-- Owner UPDATE policy (mark sold / edit). Defensive: if it was missing, a
-- seller's "已售出" update silently hit 0 rows under RLS and never persisted,
-- so other viewers kept seeing the item as available.
DROP POLICY IF EXISTS "owner can update own secondhand" ON public.secondhand;
CREATE POLICY "owner can update own secondhand"
  ON public.secondhand
  FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Auto-delete items 7 days after they were marked sold.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule('delete-sold-secondhand')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'delete-sold-secondhand');
SELECT cron.schedule(
  'delete-sold-secondhand',
  '0 * * * *',   -- hourly
  $$
    DELETE FROM public.secondhand
    WHERE is_sold = true
      AND sold_at IS NOT NULL
      AND sold_at < NOW() - INTERVAL '7 days';
  $$
);
