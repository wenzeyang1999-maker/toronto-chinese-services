# TODO List

## Supabase SQL

- [ ] Run `database/users_rls_fix.sql`
- [ ] Run `database/admin_backend_patch.sql`
- [ ] Run `database/community_reports_and_admin_logs.sql`
- [ ] Run `database/commercial_hardening_patch.sql`
- [ ] Run `database/conversation_rpc.sql`
- [ ] Run `database/admin_rpc.sql`
- [ ] Ensure `database/inquiry_matches_rls_patch.sql` has also been applied in the target Supabase project

## Edge Functions

- [ ] Deploy `supabase/functions/send-notification`
- [ ] Deploy `supabase/functions/match-inquiry-providers`

## Post-Deploy Checks

- [ ] Log in with an admin account and confirm `/admin` loads normally
- [ ] Test banning a user and confirm the banned account cannot log in
- [ ] Submit a community post report and confirm it appears in admin reports
- [ ] Submit a community comment report and confirm it appears in admin reports
- [ ] Confirm the admin bell shows unread notifications after a report is submitted
- [ ] Open a notification and confirm it marks as read
- [ ] Change an inquiry status in `/admin` and confirm the DB value actually updates
- [ ] Delete a reported post/comment from `/admin` and confirm the action succeeds
- [ ] Submit an inquiry and confirm provider matching still works
- [ ] Open a provider public page and confirm it still loads after the `users` RLS changes

## Later Improvements

- [ ] Merge legacy SQL patches into a single initialization flow
- [ ] Continue moving remaining high-risk admin actions to RPC / Edge Functions
- [ ] Add a fuller notification center page instead of bell-only dropdown
- [ ] Split large frontend bundles to reduce production chunk warnings
