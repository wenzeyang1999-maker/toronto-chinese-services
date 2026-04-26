// ─── PWA helpers ──────────────────────────────────────────────────────────────
// Service worker registration + install state detection.

export function registerServiceWorker() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  if (import.meta.env.DEV) return // Skip in dev to avoid stale caches

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => console.warn('[pwa] sw register failed:', err))
  })
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // iOS Safari uses a non-standard property
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream
}
