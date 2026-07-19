// ─── useUrgentRequestAlerts ───────────────────────────────────────────────────
// For providers who are currently「上线接单」(is_online): when a new URGENT public
// request lands over Realtime that matches one of their service categories, play
// an attention tone and pop an in-app card (<UrgentLeadPopup />).
//
// Privacy: subscribes to the public service_requests table only (no customer
// name/phone/wechat) — the contact info lives in inquiries and is fetched later
// once the provider engages. Non-urgent requests are handled by
// useRequestMatchAlerts; this hook only reacts to is_urgent rows.
import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useUrgentAlertStore } from '../store/urgentAlertStore'

// Urgent triple-beep — more insistent than the two-tone match ding.
function playUrgentSound() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const beep = (freq: number, startAt: number, dur = 0.16) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'square'
      o.frequency.value = freq
      o.connect(g); g.connect(ctx.destination)
      const t = ctx.currentTime + startAt
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.start(t)
      o.stop(t + dur + 0.02)
    }
    beep(1046, 0)
    beep(1046, 0.2)
    beep(1318, 0.4, 0.28)
  } catch {
    // iOS may block AudioContext without a user gesture — silent fail
  }
}

interface RequestRow {
  id: string
  user_id: string
  title: string
  category: string
  area: string | null
  is_urgent: boolean | null
}

export function useUrgentRequestAlerts() {
  const user = useAuthStore(s => s.user)
  const catsRef = useRef<Set<string>>(new Set())

  // Which service categories does this provider offer? (empty → not a provider)
  useEffect(() => {
    if (!user) { catsRef.current = new Set(); return }
    let cancelled = false
    supabase.from('services').select('category_id').eq('provider_id', user.id)
      .then(({ data, error }) => {
        if (cancelled || error) return
        catsRef.current = new Set((data ?? []).map((s: { category_id: string }) => s.category_id))
      })
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!user) return
    const setAlert = useUrgentAlertStore.getState().setAlert
    const channel = supabase.channel(`urgent-alerts-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'service_requests',
      }, async (payload) => {
        const r = payload.new as RequestRow
        if (!r.is_urgent) return
        if (r.user_id === user.id) return                 // not my own post
        if (!catsRef.current.has(r.category)) return       // not a category I serve
        // Only alert if I'm actually online接单 right now — read fresh so a
        // provider who went offline mid-session isn't buzzed.
        const { data } = await supabase.from('users').select('is_online').eq('id', user.id).single()
        if (!data?.is_online) return

        playUrgentSound()
        setAlert({ id: r.id, title: r.title, category: r.category, area: r.area })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])
}
