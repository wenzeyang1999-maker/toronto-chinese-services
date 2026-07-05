// ─── useRequestMatchAlerts ────────────────────────────────────────────────────
// Subscribes to service_requests INSERT events over Supabase Realtime.
// When a new request comes in that matches the current user's skill_tags,
// plays a short alert tone + shows a browser Notification + a toast.
//
// Server-side web push (for when the app isn't open) is handled separately
// by the DB trigger that calls send-web-push.
import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { toast } from '../lib/toast'
import { getCategoryById } from '../data/categories'
import type { ServiceCategory } from '../types'

// Two-tone "ding-ding" using Web Audio (no asset file required).
function playMatchSound() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const beep = (freq: number, startAt: number, dur = 0.18) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      o.connect(g); g.connect(ctx.destination)
      const t = ctx.currentTime + startAt
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.start(t)
      o.stop(t + dur + 0.02)
    }
    beep(880, 0)
    beep(1175, 0.18)
  } catch {
    // Audio context creation can fail on iOS without user gesture — silent fail
  }
}

function matchesTags(
  r: { title: string; description?: string | null; category?: string | null },
  tags: string[],
): boolean {
  if (tags.length === 0) return false
  const cat = r.category ? getCategoryById(r.category as ServiceCategory) : null
  const hay = (
    (r.title ?? '') + ' ' +
    (r.description ?? '') + ' ' +
    (cat?.label ?? '') + ' ' +
    (cat?.searchTags ?? []).join(' ')
  ).toLowerCase()
  return tags.some(t => t && hay.includes(t.toLowerCase()))
}

interface RequestRow {
  id: string
  user_id: string
  title: string
  description: string | null
  category: string | null
  area: string | null
}

export function useRequestMatchAlerts() {
  const user = useAuthStore(s => s.user)
  const tagsRef = useRef<string[]>([])
  const enabledRef = useRef(false)

  // Fetch skill_tags once per user change
  useEffect(() => {
    if (!user) { tagsRef.current = []; enabledRef.current = false; return }
    let cancelled = false
    supabase.from('users').select('skill_tags').eq('id', user.id).single()
      .then(({ data, error }) => {
        if (cancelled || error) return
        tagsRef.current = (data?.skill_tags as string[]) ?? []
        enabledRef.current = tagsRef.current.length > 0
      })
    return () => { cancelled = true }
  }, [user])

  // Realtime subscription
  useEffect(() => {
    if (!user) return
    const channel = supabase.channel(`req-alerts-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'service_requests',
      }, payload => {
        if (!enabledRef.current) return
        const r = payload.new as RequestRow
        if (r.user_id === user.id) return  // don't alert myself for my own posts
        if (!matchesTags(r, tagsRef.current)) return

        playMatchSound()
        toast(`💼 新需求：${r.title}`, 'success')

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            const n = new Notification('新需求匹配你的标签', {
              body: r.title + (r.area ? `  ·  ${r.area}` : ''),
              icon: '/icon-192.png',
              tag: `req-${r.id}`,
            })
            n.onclick = () => {
              window.focus()
              window.location.href = `/requests/${r.id}`
            }
          } catch {
            // Notification constructor not allowed in some contexts (service worker required)
          }
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])
}
