-- 老板补充:发布【需求】不受会员等级和数量限制(只有「获利类」帖子才限,如服务贴)。
-- 移除 inquiries(发需求)上的会员配额触发器。其余表暂不动(待确认「获利类」范围)。
DROP TRIGGER IF EXISTS trg_quota_inquiries ON public.inquiries;
