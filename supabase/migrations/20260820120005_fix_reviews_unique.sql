-- reviews 旧唯一约束 (service_id, reviewer_id) 与订单制多向/多单评价不兼容:
-- 师傅给「同一服务的多个客户」评价时,reviewer_id(师傅)+service_id 相同 → 违反唯一 → 提交失败;
-- 同理同一客户对同一服务复购后再评也会被挡。改为仅对「无订单的直接评价(order_id IS NULL)」生效,
-- 订单制评价的唯一性由 uq_reviews_order_dir(order_id,direction) 负责。
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_service_id_reviewer_id_key;
DROP INDEX IF EXISTS public.reviews_service_id_reviewer_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_service_reviewer_direct
  ON public.reviews(service_id, reviewer_id) WHERE order_id IS NULL;

-- 清理临时调试函数
DROP FUNCTION IF EXISTS public._dbg_reviews();
DROP FUNCTION IF EXISTS public._dbg_inquiry_triggers();
