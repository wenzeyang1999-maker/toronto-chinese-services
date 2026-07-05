// ─── Interaction Store ────────────────────────────────────────────────────────
// Combines view-count tracking and save/favourite toggling.
// Exported as two separate hooks to keep call-sites unchanged.
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { toast } from '../lib/toast'

// ─── Views ────────────────────────────────────────────────────────────────────

type TargetType = 'service' | 'job' | 'property' | 'secondhand' | 'event'

interface ViewsState {
  counts: Record<string, number>
  recordView: (type: TargetType, id: string, userId?: string) => Promise<void>
  fetchCount:  (type: TargetType, id: string) => Promise<void>
}

const VIEWS_SESSION_KEY = 'tcs_viewed'

function getViewed(): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(VIEWS_SESSION_KEY) ?? '[]')) }
  catch { return new Set() }
}
function markViewed(key: string) {
  const s = getViewed(); s.add(key)
  sessionStorage.setItem(VIEWS_SESSION_KEY, JSON.stringify([...s]))
}

export const useViewsStore = create<ViewsState>((set) => ({
  counts: {},

  async recordView(type, id, userId) {
    const k = `${type}:${id}`
    if (getViewed().has(k)) return
    markViewed(k)
    await supabase.from('views').insert({ target_type: type, target_id: id, viewer_id: userId ?? null })
    set(s => ({ counts: { ...s.counts, [k]: (s.counts[k] ?? 0) + 1 } }))
  },

  async fetchCount(type, id) {
    const k = `${type}:${id}`
    const { count } = await supabase
      .from('views')
      .select('id', { count: 'exact', head: true })
      .eq('target_type', type)
      .eq('target_id', id)
    if (count !== null) set(s => ({ counts: { ...s.counts, [k]: count } }))
  },
}))

// ─── Saves ────────────────────────────────────────────────────────────────────

interface SaveRow { id: string; target_type: string; target_id: string }

interface SavesState {
  saved:   Set<string>
  isReady: boolean
  fetchSaves:  (userId: string) => Promise<void>
  isSaved:     (type: string, id: string) => boolean
  toggleSave:  (userId: string, type: string, id: string) => Promise<void>
  clearSaves:  () => void
}

function saveKey(type: string, id: string) { return `${type}:${id}` }

export const useSavesStore = create<SavesState>((set, get) => ({
  saved:   new Set(),
  isReady: false,

  fetchSaves: async (userId) => {
    const { data } = await supabase
      .from('saves')
      .select('id, target_type, target_id')
      .eq('user_id', userId)
    set(data
      ? { saved: new Set((data as SaveRow[]).map(r => saveKey(r.target_type, r.target_id))), isReady: true }
      : { isReady: true })
  },

  isSaved: (type, id) => get().saved.has(saveKey(type, id)),

  toggleSave: async (userId, type, id) => {
    const k = saveKey(type, id)
    const already = get().saved.has(k)
    set(s => { const next = new Set(s.saved); if (already) next.delete(k); else next.add(k); return { saved: next } })

    if (already) {
      const { error } = await supabase.from('saves')
        .delete().eq('user_id', userId).eq('target_type', type).eq('target_id', id)
      if (error) { set(s => { const next = new Set(s.saved); next.add(k); return { saved: next } }); toast('取消收藏失败，请重试', 'error') }
    } else {
      const { error } = await supabase.from('saves')
        .insert({ user_id: userId, target_type: type, target_id: id })
      if (error) { set(s => { const next = new Set(s.saved); next.delete(k); return { saved: next } }); toast('收藏失败，请重试', 'error') }
    }
  },

  clearSaves: () => set({ saved: new Set(), isReady: false }),
}))
