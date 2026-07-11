// ─── Supabase Client ──────────────────────────────────────────────────────────
// Single instance shared across the entire app.
// Import { supabase } wherever you need to query the database or use auth.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '缺少 Supabase 配置：请在 .env 文件中设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Stay logged in long-term: persist the session in localStorage (survives app
    // restarts / PWA reopen) and silently refresh the access token before it
    // expires, so users don't have to re-login unless they sign out or clear data.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
