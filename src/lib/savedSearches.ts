// ─── Saved Searches ───────────────────────────────────────────────────────────
// DB-backed (public.saved_searches) for logged-in users so subscriptions follow
// them across devices. Falls back to localStorage when signed out; on first
// authenticated read any local entries are lazily migrated into the DB.
//
// newCount / "new results" badges are derived client-side from already-loaded
// services, so they are not persisted — newCount is always returned as 0 here.
import { supabase } from './supabase'

const KEY       = 'tcs_saved_searches'
const MAX_SAVED = 10

export interface SavedSearch {
  id:            string
  keyword:       string
  category?:     string
  label:         string
  createdAt:     number   // epoch ms
  lastCheckedAt: number   // epoch ms
  newCount:      number   // always 0 (kept for type compatibility)
}

function makeLabel(keyword: string, category?: string): string {
  return [keyword, category].filter(Boolean).join(' · ')
}

// ── localStorage fallback (signed-out users) ─────────────────────────────────
function localGet(): SavedSearch[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function localWrite(searches: SavedSearch[]): void {
  localStorage.setItem(KEY, JSON.stringify(searches))
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

function rowToSearch(r: {
  id: string; keyword: string; category: string | null; label: string
  created_at: string; last_checked_at: string
}): SavedSearch {
  return {
    id:            r.id,
    keyword:       r.keyword,
    category:      r.category ?? undefined,
    label:         r.label,
    createdAt:     new Date(r.created_at).getTime(),
    lastCheckedAt: new Date(r.last_checked_at).getTime(),
    newCount:      0,
  }
}

// One-time migration: when a logged-in user still has local entries, push them
// into the DB (ignoring duplicates) and clear localStorage.
async function migrateLocalIfAny(userId: string): Promise<void> {
  const local = localGet()
  if (local.length === 0) return
  await supabase.from('saved_searches').upsert(
    local.map(s => ({
      user_id:  userId,
      keyword:  s.keyword,
      category: s.category ?? null,
      label:    s.label,
    })),
    { onConflict: 'user_id,keyword,category', ignoreDuplicates: true },
  )
  localStorage.removeItem(KEY)
}

export async function getSavedSearches(): Promise<SavedSearch[]> {
  const uid = await currentUserId()
  if (!uid) return localGet()

  await migrateLocalIfAny(uid)

  const { data, error } = await supabase
    .from('saved_searches')
    .select('id, keyword, category, label, created_at, last_checked_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data.map(rowToSearch)
}

export async function saveSearch(keyword: string, category?: string): Promise<void> {
  const uid = await currentUserId()
  const label = makeLabel(keyword, category)

  if (!uid) {
    const existing = localGet()
    const dupe = existing.some(
      s => s.keyword.toLowerCase() === keyword.toLowerCase() && s.category === category,
    )
    if (dupe) return
    const entry: SavedSearch = {
      id:            crypto.randomUUID(),
      keyword,
      category,
      label,
      createdAt:     Date.now(),
      lastCheckedAt: Date.now(),
      newCount:      0,
    }
    localWrite([entry, ...existing].slice(0, MAX_SAVED))
    return
  }

  // Unique index (user_id, keyword, coalesce(category,'')) makes this idempotent;
  // ignoreDuplicates avoids erroring when the same search is saved twice.
  await supabase.from('saved_searches').upsert(
    { user_id: uid, keyword, category: category ?? null, label },
    { onConflict: 'user_id,keyword,category', ignoreDuplicates: true },
  )
}

export async function removeSavedSearch(id: string): Promise<void> {
  const uid = await currentUserId()
  if (!uid) {
    localWrite(localGet().filter(s => s.id !== id))
    return
  }
  await supabase.from('saved_searches').delete().eq('id', id)
}

// Mark a saved search as seen (touches last_checked_at). newCount is client-derived
// so there is nothing else to reset.
export async function markSearchSeen(id: string): Promise<void> {
  const uid = await currentUserId()
  if (!uid) {
    localWrite(localGet().map(s =>
      s.id === id ? { ...s, lastCheckedAt: Date.now(), newCount: 0 } : s,
    ))
    return
  }
  await supabase.from('saved_searches')
    .update({ last_checked_at: new Date().toISOString() })
    .eq('id', id)
}
