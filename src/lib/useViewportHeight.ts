import { useEffect } from 'react'

// Tracks the *visual* viewport height — which, unlike 100dvh, shrinks when the
// mobile soft keyboard opens — and exposes it as the `--app-vh` CSS variable.
// Full-screen flex containers can then use `h-[var(--app-vh,100dvh)]` so a
// bottom input bar stays above the keyboard instead of being covered by it.
//
// Falls back to 100dvh anywhere visualViewport is unsupported (older browsers).
export function useViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const apply = () => {
      document.documentElement.style.setProperty('--app-vh', `${vv.height}px`)
    }
    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
    }
  }, [])
}
