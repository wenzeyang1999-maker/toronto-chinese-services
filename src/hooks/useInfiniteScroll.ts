// ─── useInfiniteScroll ────────────────────────────────────────────────────────
// Observe a sentinel element; when it scrolls into view (300px early) and there's
// more to load and we're not already loading, fire onLoadMore. Replaces manual
// "加载更多" buttons with seamless infinite scroll.
//
// onLoadMore is kept in a ref so an inline arrow (e.g. () => fetchJobs(true))
// doesn't re-subscribe the observer every render — it only re-subscribes when
// hasMore / loading change.
import { useEffect, useRef, type RefObject } from 'react'

export function useInfiniteScroll(
  sentinelRef: RefObject<HTMLElement | null>,
  opts: { hasMore: boolean; loading: boolean; onLoadMore: () => void },
) {
  const { hasMore, loading, onLoadMore } = opts
  const cbRef = useRef(onLoadMore)
  cbRef.current = onLoadMore

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || loading) return
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) cbRef.current() },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [sentinelRef, hasMore, loading])
}
