// ─── One-tap navigation deeplinks ────────────────────────────────────────────
// Spec §4.4: iOS opens Apple Maps (maps://), everyone else opens Google Maps.
// Uses the phone's native maps app so we never render an in-app map for routing
// (and pay zero map-tile cost). Centralised here so every「导航」button behaves
// the same — previously each page hand-rolled a Google-only URL.

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

/** Turn-by-turn directions to a coordinate. */
export function navUrlToCoords(lat: number, lng: number): string {
  const dest = `${lat},${lng}`
  return isIOS()
    ? `maps://?daddr=${dest}`
    : `https://www.google.com/maps/dir/?api=1&destination=${dest}`
}

/** Directions to a free-text address (when we have no coordinates). */
export function navUrlToQuery(address: string): string {
  const q = encodeURIComponent(address)
  return isIOS()
    ? `maps://?daddr=${q}`
    : `https://www.google.com/maps/dir/?api=1&destination=${q}`
}

/** Open the native navigation app for a coordinate. */
export function openNavToCoords(lat: number, lng: number): void {
  if (typeof window !== 'undefined') window.open(navUrlToCoords(lat, lng), '_blank')
}
