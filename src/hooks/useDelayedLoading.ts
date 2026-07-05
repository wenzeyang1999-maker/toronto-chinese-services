// ─── useDelayedLoading ────────────────────────────────────────────────────────
// Returns true only if `isLoading` has stayed true past `delayMs`. Lets us show
// a skeleton ONLY when a load actually takes noticeable time — a fast load
// (data already cached / arrives in <delayMs) opens smoothly with no skeleton
// flash.
import { useEffect, useState } from 'react'

export function useDelayedLoading(isLoading: boolean, delayMs = 300): boolean {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!isLoading) { setShow(false); return }
    const t = setTimeout(() => setShow(true), delayMs)
    return () => clearTimeout(t)
  }, [isLoading, delayMs])

  return show
}
