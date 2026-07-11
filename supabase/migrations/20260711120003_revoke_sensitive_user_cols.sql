-- ─── SECURITY: users had broad client SELECT (only phone/wechat/email revoked) ─
-- Any logged-in client could `select password_hash, verification_doc_url,
-- certifications, ... from users` for every user. These three have NO frontend
-- display use — revoke outright. (credit_penalty / notification_prefs are read
-- by the app for display/self and are handled separately.)
DO $$
BEGIN
  REVOKE SELECT (password_hash)        ON public.users FROM PUBLIC, anon, authenticated;
  REVOKE SELECT (verification_doc_url) ON public.users FROM PUBLIC, anon, authenticated;
  REVOKE SELECT (certifications)       ON public.users FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_column THEN
  -- a column may not exist in every environment; ignore
  NULL;
END $$;
