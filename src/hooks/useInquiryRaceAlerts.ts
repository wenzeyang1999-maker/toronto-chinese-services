// ─── useInquiryRaceAlerts ─────────────────────────────────────────────────────
// Subscribes to new inquiries via Supabase Realtime.
// When a new inquiry's category_id matches the provider's categories,
// plays an alert sound and fires a callback.
// Used by InquiryRaceAlert to surface the "抢单" UI.
import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORIES } from '../data/categories'

export interface IncomingInquiry {
  id: string
  category_id: string
  categoryLabel: string
  description: string
  timing: string
  budget: string | null
  created_at: string
}

interface Options {
  /** IDs of categories this provider offers (from their services rows). */
  providerCategoryIds: string[]
  onInquiry: (inquiry: IncomingInquiry) => void
}

function playAlert() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const play = (freq: number, start: number) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.4, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.35)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + 0.35)
    }
    play(880, 0)
    play(1100, 0.2)
  } catch { /* audio not available */ }
}

export function useInquiryRaceAlerts({ providerCategoryIds, onInquiry }: Options) {
  const onInquiryRef = useRef(onInquiry)
  useEffect(() => { onInquiryRef.current = onInquiry })

  useEffect(() => {
    if (!providerCategoryIds.length) return

    const catSet = new Set(providerCategoryIds)

    const channel = supabase
      .channel('inquiry-race-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inquiries' },
        (payload) => {
          const row = payload.new as any
          if (!catSet.has(row.category_id)) return

          playAlert()

          const cat = CATEGORIES.find(c => c.id === row.category_id)
          onInquiryRef.current({
            id:            row.id,
            category_id:   row.category_id,
            categoryLabel: cat ? `${cat.emoji} ${cat.label}` : row.category_id,
            description:   row.description ?? '',
            timing:        row.timing ?? 'flexible',
            budget:        row.budget ?? null,
            created_at:    row.created_at,
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [providerCategoryIds.join(',')])   // eslint-disable-line react-hooks/exhaustive-deps
}
