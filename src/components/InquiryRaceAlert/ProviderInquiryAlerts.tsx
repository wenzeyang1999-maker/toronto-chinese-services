// ─── ProviderInquiryAlerts ────────────────────────────────────────────────────
// Mounts in App.tsx. Fetches provider's service categories, subscribes to new
// inquiries, and renders the race alert banners.
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useInquiryRaceAlerts, type IncomingInquiry } from '../../hooks/useInquiryRaceAlerts'
import { InquiryRaceAlertContainer } from './InquiryRaceAlert'

export default function ProviderInquiryAlerts() {
  const user = useAuthStore((s) => s.user)
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [alerts, setAlerts] = useState<IncomingInquiry[]>([])

  // Fetch provider's offered category IDs once per user change
  useEffect(() => {
    if (!user) { setCategoryIds([]); return }
    let cancelled = false
    supabase
      .from('services')
      .select('category_id')
      .eq('provider_id', user.id)
      .eq('is_available', true)
      .then(({ data }) => {
        if (cancelled || !data) return
        const ids = [...new Set(data.map((r: any) => r.category_id as string).filter(Boolean))]
        setCategoryIds(ids)
      })
    return () => { cancelled = true }
  }, [user?.id])

  useInquiryRaceAlerts({
    providerCategoryIds: categoryIds,
    onInquiry: (inquiry) => {
      setAlerts(prev => {
        // Deduplicate
        if (prev.some(a => a.id === inquiry.id)) return prev
        return [...prev, inquiry]
      })
    },
  })

  if (alerts.length === 0) return null

  return (
    <InquiryRaceAlertContainer
      inquiries={alerts}
      onDismiss={(id) => setAlerts(prev => prev.filter(a => a.id !== id))}
    />
  )
}
