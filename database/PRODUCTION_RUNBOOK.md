# Production Runbook

This project relies on a few follow-up SQL patches after the base schema.

## Recommended SQL order for a fresh environment

1. `database/schema.sql`
2. module schemas:
   - `database/jobs_schema.sql`
   - `database/realestate_schema.sql`
   - `database/secondhand_schema.sql`
   - `database/events_schema.sql`
   - `database/community_schema.sql`
   - `database/community_likes_schema.sql`
   - `database/follows_schema.sql`
   - `database/saves_schema.sql`
   - `database/views_schema.sql`
   - `database/qa_schema.sql`
   - `database/review_replies_schema.sql`
   - `database/review_interactions_schema.sql`
   - `database/inquiries_schema.sql`
3. migrations / data patches:
   - `database/location_migration.sql`
   - `database/bio_migration.sql`
   - `database/membership_migration.sql`
   - `database/verification_migration.sql`
   - `database/post_status_migration.sql`
   - `database/promoted_migration.sql`
   - `database/avg_reply_hours_migration.sql`
4. security patches:
   - `database/rls_security_patch.sql`
   - `database/review_replies_rls_patch.sql`
   - `database/inquiry_matches_rls_patch.sql`
   - `database/users_rls_fix.sql`
   - `database/admin_backend_patch.sql`
   - `database/community_reports_and_admin_logs.sql`
   - `database/commercial_hardening_patch.sql`
5. sync / repair helpers when needed:
   - `database/sync_auth_users.sql`
   - `database/fix_orphan_users.sql`
   - `database/referral_repair.sql`

## Edge Functions to deploy

1. `supabase/functions/send-notification`
2. `supabase/functions/match-inquiry-providers`
3. `supabase/functions/ai-chat`

## Highest-priority manual checks after deploy

1. Login with an admin account and open `/admin`
2. Submit a community post report and a comment report
3. Confirm:
   - admin bell shows unread notification
   - `/admin` community reports list updates
   - admin audit log is written
4. Submit an inquiry and verify provider matching still works
5. Open a provider public page and confirm it loads with tightened `users` RLS
