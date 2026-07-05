// ─── usePullToRefresh ─────────────────────────────────────────────────────────
// Touch-based "pull down to refresh" for mobile web.
// Works on either a nested scroll container (pass scrollRef) or the whole
// document (omit scrollRef → listens on window / uses window.scrollY).
//
// Returns { distance, refreshing } so the caller can render an indicator and
// optionally translate its content for the rubber-band feel.
//
// Notes:
// - Handlers read from refs (not state) so the effect attaches listeners ONCE,
//   not on every touchmove.
// - touchmove is registered non-passive so we can preventDefault() the native
//   scroll-bounce while the user is actively pulling from the top.
import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

const THRESHOLD = 64   // px pulled (after resistance) needed to trigger refresh
const MAX       = 90   // px cap on how far the indicator travels
const RESIST    = 0.5  // drag resistance — finger moves 2px per 1px of pull

export function usePullToRefresh(
  onRefresh: () => Promise<unknown> | void,
  scrollRef?: RefObject<HTMLElement | null>,
  enabled = true,
) {
  const [distance, setDistance]     = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const cbRef    = useRef(onRefresh); cbRef.current = onRefresh
  const distRef  = useRef(0)
  const busyRef  = useRef(false)
  const startY   = useRef<number | null>(null)
  const pulling  = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const getTop = () =>
      scrollRef?.current
        ? scrollRef.current.scrollTop
        : (window.scrollY || document.documentElement.scrollTop || 0)

    const setDist = (d: number) => { distRef.current = d; setDistance(d) }

    const onStart = (e: TouchEvent) => {
      if (busyRef.current || getTop() > 0) { startY.current = null; return }
      startY.current = e.touches[0].clientY
      pulling.current = false
    }

    const onMove = (e: TouchEvent) => {
      if (startY.current == null || busyRef.current) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0 || getTop() > 0) {
        if (pulling.current) { pulling.current = false; setDist(0) }
        return
      }
      pulling.current = true
      if (e.cancelable) e.preventDefault()   // block native rubber-band while pulling
      setDist(Math.min(MAX, dy * RESIST))
    }

    const onEnd = async () => {
      if (startY.current == null) return
      startY.current = null
      if (!pulling.current) return
      pulling.current = false

      if (distRef.current >= THRESHOLD) {
        busyRef.current = true
        setRefreshing(true)
        setDist(THRESHOLD)                    // hold at threshold while loading
        try { await cbRef.current() } catch { /* store surfaces its own toast */ }
        busyRef.current = false
        setRefreshing(false)
        setDist(0)
      } else {
        setDist(0)
      }
    }

    const target: HTMLElement | Window = scrollRef?.current ?? window
    target.addEventListener('touchstart',  onStart as EventListener, { passive: true })
    target.addEventListener('touchmove',   onMove  as EventListener, { passive: false })
    target.addEventListener('touchend',    onEnd   as EventListener)
    target.addEventListener('touchcancel', onEnd   as EventListener)
    return () => {
      target.removeEventListener('touchstart',  onStart as EventListener)
      target.removeEventListener('touchmove',   onMove  as EventListener)
      target.removeEventListener('touchend',    onEnd   as EventListener)
      target.removeEventListener('touchcancel', onEnd   as EventListener)
    }
  }, [scrollRef, enabled])

  return { distance, refreshing, threshold: THRESHOLD }
}
