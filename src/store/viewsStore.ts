// ─── Views Store ──────────────────────────────────────────────────────────────
// Tracks page view counts per listing.
// Dedup: each (target_type + target_id) is only recorded once per browser
// session via sessionStorage, preventing refresh-spam inflation.
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

type TargetType = 'service' | 'job' | 'property' | 'secondhand' | 'event'

interface ViewsState {
  /** count cache: "type:id" → number */
  counts: Record<string, number>
  /** Record a view; no-op if already seen this session */
  recordView: (type: TargetType, id: string, userId?: string) => Promise<void>
  /** Fetch the current view count for a listing */
  fetchCount: (type: TargetType, id: string) => Promise<void>
}

const STORAGE_KEY = 'tcs_viewed'

function getViewed(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function markViewed(key: string) {
  const set = getViewed()
  set.add(key)
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
}

export const useViewsStore = create<ViewsState>((set, get) => ({
  counts: {},

  async recordView(type, id, userId) {
    const key = `${type}:${id}`
    if (getViewed().has(key)) return          // already counted this session
    markViewed(key)

    await supabase.from('views').insert({
      target_type: type,
      target_id:   id,
      viewer_id:   userId ?? null,
    })

    // Update local cache optimistically
    set(s => ({ counts: { ...s.counts, [key]: (s.counts[key] ?? 0) + 1 } }))
  },

  async fetchCount(type, id) {
    const key = `${type}:${id}`
    const { count } = await supabase
      .from('views')
      .select('id', { count: 'exact', head: true })
      .eq('target_type', type)
      .eq('target_id', id)
    if (count !== null) {
      set(s => ({ counts: { ...s.counts, [key]: count } }))
    }
  },
}))
