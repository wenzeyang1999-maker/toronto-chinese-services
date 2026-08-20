-- 「我的发布」删不掉 bug:services 早已改软删(soft_delete_service RPC),但前端还在硬删
-- (被 RLS 挡且静默失败,前端不查 error 就乐观删 UI → 刷新又回来,只能去 DB 删)。
-- services 走 RPC(前端改);jobs/properties/secondhand/events 这里补 owner 删除策略,
-- 让作者能删除自己的帖子(这些表无评价/订单外键绑定,硬删安全)。

DROP POLICY IF EXISTS "owner can delete own jobs" ON public.jobs;
CREATE POLICY "owner can delete own jobs" ON public.jobs
  FOR DELETE TO authenticated USING (poster_id = auth.uid());

DROP POLICY IF EXISTS "owner can delete own properties" ON public.properties;
CREATE POLICY "owner can delete own properties" ON public.properties
  FOR DELETE TO authenticated USING (poster_id = auth.uid());

DROP POLICY IF EXISTS "owner can delete own secondhand" ON public.secondhand;
CREATE POLICY "owner can delete own secondhand" ON public.secondhand
  FOR DELETE TO authenticated USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "owner can delete own events" ON public.events;
CREATE POLICY "owner can delete own events" ON public.events
  FOR DELETE TO authenticated USING (poster_id = auth.uid());
