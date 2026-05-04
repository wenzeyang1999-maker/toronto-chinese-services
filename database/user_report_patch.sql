-- user_report_patch.sql
-- Adds 'user' as a valid content_type so users can be reported from chat.

ALTER TABLE public.content_reports
  DROP CONSTRAINT IF EXISTS content_reports_content_type_check;

ALTER TABLE public.content_reports
  ADD CONSTRAINT content_reports_content_type_check
  CHECK (content_type IN (
    'community_post', 'community_comment',
    'service', 'secondhand', 'job', 'property', 'event',
    'user'
  ));
