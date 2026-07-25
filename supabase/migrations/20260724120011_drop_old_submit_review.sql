-- 删除旧的 3 参 submit_review，避免与新 4 参(带 tags)重载歧义
DROP FUNCTION IF EXISTS public.submit_review(uuid, int, text);
