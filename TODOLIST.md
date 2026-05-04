# TODO List

## Supabase SQL

- [x] Run `database/users_rls_fix.sql`
- [x] Run `database/admin_backend_patch.sql`
- [x] Run `database/community_reports_and_admin_logs.sql`
- [x] Run `database/commercial_hardening_patch.sql`
- [x] Run `database/conversation_rpc.sql`
- [x] Run `database/admin_rpc.sql`
- [x] Ensure `database/inquiry_matches_rls_patch.sql` has also been applied in the target Supabase project

## Edge Functions

- [x] Deploy `supabase/functions/send-notification`
- [x] Deploy `supabase/functions/match-inquiry-providers`

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

---

## Design & Backend Audit — 2026-04-26

### CRITICAL — Performance & Correctness

- [ ] **ProviderProfile sequential Supabase queries**: `ProviderPage` fetches provider info, services, reviews, follow status in separate `await` chains instead of `Promise.all`. On a slow connection this adds 200–600 ms of extra latency. Parallelize with `Promise.all`.
- [ ] **ServiceDetail N+1 query**: Service detail page fetches provider info separately after the service row loads. Combine into a single select with a join or fetch in parallel.
- [ ] **AI chat has no timeout**: `supabase/functions/ai-chat/index.ts` calls Groq with no `AbortSignal` / timeout. A hung Groq call will hold the edge function open until platform kills it (60 s). Add `AbortSignal.timeout(20_000)`.
- [ ] **`getRegistration` guard missing on all push paths**: Only `webPush.ts` was patched. Any other direct `serviceWorker.ready` call in future code will hang in dev mode. Audit and apply the guard consistently.
- [ ] **No coordinate validation before saving**: A service can be saved with `lat = 0, lng = 0` (null island). Add a check: if both are zero, treat as no location.

### HIGH — Missing Features

- [ ] **Community post cannot be edited after publishing**: `CommunitySection` and community post detail have no edit flow. Add an edit button (owner-only) that re-opens the compose form pre-filled.
- [ ] **No sort / filter persistence**: All filter state (category, area, price range, sort) lives in component state and resets on navigation. Sync to URL search params so back-navigation restores the previous view.
- [ ] **No "block provider" in chat**: `MessagesSection` has no way to block or report a provider. Add a report/block button in the conversation header.
- [ ] **Inquiry (获取报价) has no status shown to user**: After submitting an inquiry, the user has no UI to track responses. Add an "我的报价请求" list showing inquiry status + provider replies.
- [ ] **No pagination on service list**: The main service list fetches all matching records. Add cursor-based or page-based pagination (20 items/page) and an infinite-scroll or "Load more" trigger.
- [ ] **No "re-send message" on failure**: Chat send errors silently swallow the failure. Show an inline retry button on failed messages.
- [ ] **Referral rewards are not automated**: `count_my_referrals` RPC counts referrals but nothing grants membership upgrades or credits when a threshold is hit. Wire up a trigger or edge function.
- [ ] **No push notification preference center**: Users can subscribe/unsubscribe globally but cannot choose which event types trigger a push (new message vs. new inquiry vs. promotional).
- [ ] **Service search has no full-text search**: Filtering is category + area only. Add Postgres `tsvector` full-text search on `title + description` and expose a search input on the service list page.
- [ ] **No "report service" button on service detail page**: Users can report community posts but not services. Add a report flow on `ServiceDetail` that creates a moderation ticket.

### HIGH — UI / UX

- [ ] **Empty states are missing in several views**: `SavesSection`, `FollowsSection`, `BrowseSection`, and `MessagesSection` all show a blank white area when empty. Add illustrated empty-state components with a CTA ("还没有收藏，去看看吧").
- [ ] **WeChat copy uses `alert()`**: Copying the WeChat ID in `VerificationSection` and `ProviderProfile` falls back to `alert('微信号：...')` when clipboard API fails. Replace with an in-page toast notification.
- [ ] **No error boundaries**: The app has no React `ErrorBoundary`. Any unhandled render error in a section shows a blank white page. Add a top-level boundary that shows a friendly error card with a reload button.
- [ ] **`alert()` used for upload errors throughout**: Cover upload, avatar upload, and doc upload all call `alert(...)` on failure. Replace with inline error messages.
- [ ] **Mobile keyboard pushes map off-screen**: On mobile, opening the search bar on the home page or inquiry form causes the Google Map underneath to resize weirdly. Use `dvh` units or `visualViewport` listener to keep map height stable.
- [ ] **Tab bar on Profile overlaps content on small phones**: The sticky tab bar on `HomepageSection` uses `top-14` but on phones shorter than 667 px the content is partially hidden. Add scroll-margin-top to section anchors.
- [ ] **Cover image aspect ratio not enforced**: Cover upload accepts any image. On tall portrait images the cover area looks wrong. Crop/resize to 3:1 aspect ratio client-side before upload.
- [ ] **"查看详情" in map popup navigates via `onclick`**: The buttons in `ServiceMap`'s InfoWindow use vanilla `onclick` instead of React Router. This bypasses the SPA router, causing a full page reload on iOS. Use `navigate()` (already wired via `onInfoReady`) — confirm no full reload occurs.
- [ ] **MembershipBadge tooltip not shown on mobile**: Tapping the membership badge shows no explanation of what L1/L2/L3 means. Add a tap-to-show tooltip or link to the MembershipSection.
- [ ] **No skeleton loaders**: Most sections show nothing while loading. Add skeleton placeholder cards (matching the real card shape) to prevent layout shift.

### MEDIUM — Database & Security

- [ ] **Missing composite index on `services(category_id, is_available)`**: The main service list filters by both columns on every load. Add: `CREATE INDEX IF NOT EXISTS idx_services_cat_avail ON services(category_id, is_available);`
- [ ] **Missing index on `community_posts(created_at DESC)`**: Community feed sorts by `created_at` on every page load with no index. Add: `CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC);`
- [ ] **Missing index on `messages(conversation_id, created_at)`**: Chat history query does a sequential scan per conversation. Add composite index.
- [ ] **Missing index on `push_subscriptions(user_id)`**: Web push lookup on login/logout does a full scan. Add: `CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);`
- [ ] **Self-messaging not blocked at DB level**: RLS on `messages` only checks that the sender is authenticated; nothing prevents `sender_id = recipient_id`. Add a check constraint: `CHECK (sender_id <> recipient_id)`.
- [ ] **`services.price` has no range validation**: Price can be set to negative or absurdly large values. Add: `CHECK (price IS NULL OR (price >= 0 AND price <= 100000))`.
- [ ] **`users.is_online` has no automatic reset**: If the server crashes while a user is "online", they stay flagged online forever. Add a Supabase scheduled function (pg_cron) that resets `is_online = false` for users whose `last_seen` is older than 24 hours.
- [ ] **`social_links` JSONB field is overloaded**: Cover URL, tags, and social media links all share one JSONB column with magic keys `_cover`, `_tags`. Extract to dedicated columns: `cover_url TEXT`, `tags TEXT[]`, `social_links JSONB` (for actual social links only).
- [ ] **No soft-delete on services**: Deleting a service is permanent. Old inquiry/conversation records that reference the service ID break silently. Add `deleted_at TIMESTAMP` and filter `WHERE deleted_at IS NULL`.
- [ ] **No audit log for admin actions**: `admin_logs` table exists but not all admin mutations write to it (e.g., membership grants, feature flag changes). Enforce writes via RPC.
- [ ] **`referral_code` not unique-indexed**: The column has a unique constraint but no explicit index. Verify with `\d users` and add if missing: `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);`

### MEDIUM — Admin Panel

- [ ] **No search in admin user list**: Admin can only scroll/paginate through users. Add a search input that filters by name, email, or referral code.
- [ ] **No undo for ban / membership grant**: Admin actions are instant and irreversible from the UI. Add a confirmation dialog and a 5-second undo toast before the DB write commits.
- [ ] **No analytics dashboard**: Admin has no view of DAU, new sign-ups per day, services posted per week, or inquiry volume. Add a simple charts page using the existing `stats` RPC data.
- [ ] **No bulk actions**: Admin cannot ban or delete multiple users/services at once. Add checkbox selection + bulk action toolbar.
- [ ] **Reported content queue has no "resolve" state**: Admin can delete reported posts but cannot mark a report as reviewed-and-dismissed (false positive). Add a `dismissed_at` field and a dismiss button.
- [ ] **Admin cannot edit service content**: If a service has policy-violating text, admin must delete it entirely. Add an admin edit flow for service `title`, `description`, `price`.
- [ ] **No rate-limit visible in admin**: Admin cannot see which IPs or users are hitting the AI chat or push API the most. Surface top consumers in the admin dashboard.

### LOW — Copy & Content

- [ ] **Inconsistent verified badge display**: `VerifiedBadge` shows for users with any verified field, but the tooltip says "已认证商家" even for individual users who only verified their phone. Show granular badges: "手机已验证", "商户已认证".
- [ ] **Generic "未知错误" error messages**: Many catch blocks show `'未知错误'`. Replace with more actionable messages ("网络超时，请稍后重试" vs "服务器拒绝请求，请联系客服").
- [ ] **"面议" price not translated in English UI paths**: If the user's browser language is English, `面议` renders untranslated. Add English fallback: "Negotiable".
- [ ] **Category labels missing in AI chat response**: When AI recommends a service, it lists the raw `category_id` key (e.g., `cashwork`) not the display label. The label map in `ai-chat/index.ts` covers common cases but `label[cat] ?? cat` still leaks raw keys for uncovered categories. Add all categories.
- [ ] **PWA install prompt shows on every session**: `InstallPrompt` in `App.tsx` fires on every load if the `beforeinstallprompt` event fires. Suppress it if the user previously dismissed it (store a `tcs_install_dismissed` flag in localStorage).
- [ ] **"共 X 家" counter in map legend double-counts**: `mapped.length` counts all services with coordinates, not unique providers. If one provider has 3 services they count as 3. Show "共 X 项服务" or deduplicate by provider.
- [ ] **Service card "距您 X km" uses straight-line distance**: The distance shown is Haversine (bird's-eye). Label it "直线距离" or switch to Google Maps Distance Matrix API for driving distance.
- [ ] **No 404 page for `/provider/:id` when provider doesn't exist**: Visiting a dead provider link shows an infinite spinner. Add a `Not Found` state when the Supabase query returns null.
