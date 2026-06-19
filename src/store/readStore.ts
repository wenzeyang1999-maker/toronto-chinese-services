// ─── Read Store ────────────────────────────────────────────────────────────────
// Persists which posts the user has already viewed.
// Guests:        localStorage only (survives page refresh, lost on clear/device switch)
// Logged-in:     localStorage + Supabase user_read_posts (synced across devices)
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export type ReadableType = 'service' | 'job' | 'property' | 'secondhand' | 'event' | 'community'

const STORAGE_KEY = 'tcs_read'
const MAX_ENTRIES = 500

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function persist(s: Set<string>) {
  try {
    let arr = [...s]
    if (arr.length > MAX_ENTRIES) arr = arr.slice(arr.length - MAX_ENTRIES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
  } catch { /* localStorage unavailable — ignore */ }
}

interface ReadState {
  read:     Set<string>
  markRead: (type: ReadableType, id: string) => void
  hydrate:  (keys: string[]) => void
}

export const useReadStore = create<ReadState>((set, get) => ({
  read: load(),

  markRead(type, id) {
    const key  = `${type}:${id}`
    const prev = get().read
    if (prev.has(key)) return
    const next = new Set(prev)
    next.add(key)
    persist(next)
    set({ read: next })

    // Fire-and-forget write to Supabase for logged-in users
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return
      supabase.from('user_read_posts').upsert(
        { user_id: data.session.user.id, type, post_id: id },
        { onConflict: 'user_id,type,post_id' }
      )
    })
  },

  hydrate(keys) {
    if (!keys.length) return
    const prev = get().read
    const next = new Set(prev)
    keys.forEach((k) => next.add(k))
    persist(next)
    set({ read: next })
  },
}))
