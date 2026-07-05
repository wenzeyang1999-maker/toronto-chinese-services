// ─── geo helpers ───────────────────────────────────────────────────────────────
// Shared between the home feed, the appStore, and anywhere else that needs to
// compute distances client-side.

/** Haversine formula — returns the great-circle distance in kilometres. */
export function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Privacy offset for any user location shown publicly on a map (demand pins,
 * public request posts). Shifts the point a random 300–900 m in a random
 * direction, then rounds to 3 decimals (~110 m grid) so the marker never sits
 * on the true address. Compute ONCE before storing so the point is stable for
 * every viewer.
 */
export function offsetLocation(lat: number, lng: number): { lat: number; lng: number } {
  const R = 6_371_000                          // earth radius (m)
  const dist = 300 + Math.random() * 600       // 300–900 m away
  const bearing = Math.random() * 2 * Math.PI  // random direction
  const dLat = (dist * Math.cos(bearing)) / R
  const dLng = (dist * Math.sin(bearing)) / (R * Math.cos((lat * Math.PI) / 180))
  return {
    lat: Math.round((lat + (dLat * 180) / Math.PI) * 1000) / 1000,
    lng: Math.round((lng + (dLng * 180) / Math.PI) * 1000) / 1000,
  }
}
