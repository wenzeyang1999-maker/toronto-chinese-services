-- ─── FIX (part 2): 发布者仍无法关闭自己的需求，根因是 SELECT 策略 ───────────────
-- service_requests 唯一的 SELECT 策略是「Anyone can read open requests」USING
-- (status='open')。当发布者把 status 改成 'closed' 时，新行离开了这条 SELECT 可见
-- 集合，PostgREST 的 UPDATE 因新行对本人不可见而被拒（42501）。仅放开 UPDATE 的
-- WITH CHECK（上一条迁移）不够——还需让发布者能 SELECT 到自己的行（无论 status）。
--
-- 加一条 owner-only 的 SELECT 策略（与既有「公开只读 open」并存，PERMISSIVE = OR）：
-- 发布者可读自己的任意状态需求；他人仍只能看 open 的。既修复关闭，也让「我的交易」
-- 未来能展示自己已关闭的需求。
DROP POLICY IF EXISTS "Owner can read own requests" ON public.service_requests;
CREATE POLICY "Owner can read own requests"
  ON public.service_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- 清理上一步的临时排查函数
DROP FUNCTION IF EXISTS public._debug_sr_policies();
