-- ─── inquiries: allow the owner to UPDATE their own row ──────────────────────
-- inquiries had only INSERT + SELECT policies (+ admin ALL) — NO update policy
-- for regular users. So a customer's "关闭此请求" (set status='closed') and
-- "选择服务商" (set assigned_provider_id) were silently filtered to 0 rows by
-- RLS and never persisted: the request reappeared as open on reload.
-- Grant the owner UPDATE on their own inquiries.
DROP POLICY IF EXISTS "owner can update own inquiries" ON public.inquiries;
CREATE POLICY "owner can update own inquiries"
  ON public.inquiries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
