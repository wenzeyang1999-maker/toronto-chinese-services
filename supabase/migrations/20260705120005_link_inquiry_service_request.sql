-- ─── Link a public service_request back to its inquiry ───────────────────────
-- When a customer posts via 「AI 帮你找」 + 「同时发布公开需求帖」, two rows are
-- created: an inquiry (private, in 我的报价请求) and a service_request (public
-- demand pin on the map). They were unlinked, so closing one left the other
-- open. Add a nullable link so a close on either side can cascade to the other.
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS inquiry_id uuid REFERENCES public.inquiries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS service_requests_inquiry_id_idx
  ON public.service_requests(inquiry_id);
