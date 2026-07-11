import { useMemo } from 'react'
import { useAppStore } from '../../store/appStore'
import type { BrowseEntry } from '../../types/browse'

// Personalised ranking used by both the top「猜你喜欢」strip and the bottom
// full feed. Scores by rating · trust tier · freshness · browsed-category
// affinity · promotion · membership visibility. Single source of truth so the
// two placements always agree (and de-dup cleanly).
export function useRankedServices(excludeIds?: string[]) {
  const services = useAppStore((s) => s.services)
  const excludeKey = (excludeIds ?? []).join(',')

  return useMemo(() => {
    if (services.length === 0) return []
    const excludeSet = new Set(excludeKey ? excludeKey.split(',') : [])

    // Category affinity from browse history (ordered by recency)
    const recentCats: string[] = []
    try {
      const entries: BrowseEntry[] = JSON.parse(localStorage.getItem('tcs_browse_history') ?? '[]')
      const seen = new Set<string>()
      for (const e of entries) {
        if (e.category && !seen.has(e.category)) {
          seen.add(e.category)
          recentCats.push(e.category)
        }
      }
    } catch { /* ignore */ }

    const now = Date.now()

    return [...services]
      .filter((s) => s.available && !excludeSet.has(s.id))
      .map((s) => {
        let score = 0
        score += s.provider.rating * 20
        if (s.provider.businessVerified) score += 30
        else if (s.provider.verified) score += 20
        else if (s.provider.phoneVerified) score += 10

        const ageDays = (now - new Date(s.createdAt).getTime()) / 86_400_000
        if (ageDays < 7) score += 15
        else if (ageDays < 30) score += 8
        else if (ageDays < 90) score += 3

        const catIdx = recentCats.indexOf(s.category)
        if (catIdx === 0) score += 25
        else if (catIdx === 1) score += 15
        else if (catIdx === 2) score += 10

        if (s.isPromoted) score += 20
        if (s.provider.membershipLevel === 'L3') score += 30
        else if (s.provider.membershipLevel === 'L2') score += 15

        return { s, score }
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.s)
  }, [services, excludeKey])
}
