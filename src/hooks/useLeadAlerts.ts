// ─── useLeadAlerts ────────────────────────────────────────────────────────────
// Keeps the lead-alert count fresh for the logged-in user: fetches the unread
// count once, then live-increments on new "new_inquiry_lead" notifications
// (notifications is in the realtime publication). Mount once, app-wide.
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useLeadAlertsStore } from '../store/leadAlertsStore'

export function useLeadAlerts() {
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!user) { useLeadAlertsStore.getState().reset(); return }
    const store = useLeadAlertsStore.getState()
    void store.fetchCount(user.id)

    const ch = supabase
      .channel(`lead-alerts-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
        (payload) => {
          if ((payload.new as { type?: string }).type === 'new_inquiry_lead') {
            useLeadAlertsStore.getState().increment()
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [user])
}
