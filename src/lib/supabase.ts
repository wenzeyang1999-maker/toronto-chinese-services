// ─── Supabase Client ──────────────────────────────────────────────────────────
// Single instance shared across the entire app.
// Import { supabase } wherever you need to query the database or use auth.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
