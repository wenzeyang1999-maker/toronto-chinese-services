// ─── Saves Store (Zustand) ────────────────────────────────────────────────────
// Tracks which items the current user has saved (favourited).
// Loads once on first use; toggle is optimistic.
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

type TargetType = 'service' | 'job' | 'property' | 'secondhand' | 'event'

interface SaveRow { id: string; target_type: string; target_id: string }

interface SavesState {
  // Set of "targetType:targetId" strings for O(1) lookup
  saved: Set<string>
  isReady: boolean

  fetchSaves:  (userId: string) => Promise<void>
  isSaved:     (type: TargetType, id: string) => boolean
  toggleSave:  (userId: string, type: TargetType, id: string) => Promise<void>
  clearSaves:  () => void
}

function key(type: string, id: string) { return `${type}:${id}` }

export const useSavesStore = create<SavesState>((set, get) => ({
  saved:   new Set(),
  isReady: false,

  fetchSaves: async (userId) => {
    const { data } = await supabase
      .from('saves')
      .select('id, target_type, target_id')
      .eq('user_id', userId)
    if (data) {
      set({ saved: new Set((data as SaveRow[]).map(r => key(r.target_type, r.target_id))), isReady: true })
    } else {
      set({ isReady: true })
    }
  },

  isSaved: (type, id) => get().saved.has(key(type, id)),

  toggleSave: async (userId, type, id) => {
    const k = key(type, id)
    const already = get().saved.has(k)

    // Optimistic update
    set((state) => {
      const next = new Set(state.saved)
      if (already) { next.delete(k) } else { next.add(k) }
      return { saved: next }
    })

    if (already) {
      const { error } = await supabase.from('saves')
        .delete()
        .eq('user_id', userId)
        .eq('target_type', type)
        .eq('target_id', id)
      if (error) {
        // Rollback
        set((state) => { const next = new Set(state.saved); next.add(k); return { saved: next } })
      }
    } else {
      const { error } = await supabase.from('saves')
        .insert({ user_id: userId, target_type: type, target_id: id })
      if (error) {
        // Rollback
        set((state) => { const next = new Set(state.saved); next.delete(k); return { saved: next } })
      }
    }
  },

  clearSaves: () => set({ saved: new Set(), isReady: false }),
}))
