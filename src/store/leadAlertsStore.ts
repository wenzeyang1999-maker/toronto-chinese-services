// ─── Lead Alerts Store ────────────────────────────────────────────────────────
// Tracks how many unread "new_inquiry_lead" notifications the current merchant
// has — i.e. new inquiries dispatched to them that they haven't looked at yet.
// Drives the red-dot badge on 「我接的单」 and the bottom-nav 「我的」 tab so a
// merchant spots leads without opening the notification bell.
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface LeadAlertsState {
  count: number
  fetchCount: (userId: string) => Promise<void>
  markSeen: (userId: string) => Promise<void>
  increment: () => void
  reset: () => void
}

export const useLeadAlertsStore = create<LeadAlertsState>((set) => ({
  count: 0,

  fetchCount: async (userId) => {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('type', 'new_inquiry_lead')
      .is('read_at', null)
    if (!error) set({ count: count ?? 0 })
  },

  // Called when the merchant opens 「我接的单」 — clear the badge + mark the
  // lead notifications read so it doesn't light up again for the same leads.
  markSeen: async (userId) => {
    set({ count: 0 })
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', userId)
      .eq('type', 'new_inquiry_lead')
      .is('read_at', null)
  },

  increment: () => set((s) => ({ count: s.count + 1 })),
  reset: () => set({ count: 0 }),
}))
