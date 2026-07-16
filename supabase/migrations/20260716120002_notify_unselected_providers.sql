-- ─── 说明书 §4.4：录用后向未被选中的其余师傅发「体面通知」──────────────────────
-- 客户在报价面板选定一位师傅（inquiries.assigned_provider_id 被设）时，自动给其余
-- 抢单师傅（accepted_provider_ids 中除中选者外）发一条站内通知，礼貌告知本次未被
-- 录用。触发器实现，任何设置 assigned_provider_id 的路径都覆盖。

CREATE OR REPLACE FUNCTION public.notify_inquiry_unselected()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_provider_id IS NOT NULL
     AND OLD.assigned_provider_id IS DISTINCT FROM NEW.assigned_provider_id THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, link_url)
      SELECT pid, 'inquiry_not_selected', '本次未被选中',
             '感谢您的接单～客户本次选择了其他服务商，期待下次为您带来合作机会 🙏',
             '/profile?section=claimed_inquiries'
        FROM unnest(NEW.accepted_provider_ids) AS pid
       WHERE pid IS NOT NULL AND pid <> NEW.assigned_provider_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_inquiry_unselected ON public.inquiries;
CREATE TRIGGER trg_inquiry_unselected
  AFTER UPDATE OF assigned_provider_id ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.notify_inquiry_unselected();
