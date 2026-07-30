// ─── Google Static Maps URL ───────────────────────────────────────────────────
// A static map image is billed ~$2/1000 (vs ~$7/1000 for an interactive dynamic
// map) and is browser-cacheable, so using it for the "位置" preview on detail
// pages cuts Google Maps cost a lot while keeping the location visible. Tap the
// image → native navigation (see lib/navigation.ts).
import { getGoogleMapsApiKey } from './googleMaps'

interface Opts {
  zoom?: number
  width?: number
  height?: number
  scale?: 1 | 2   // 2 = retina
}

export function staticMapUrl(lat: number, lng: number, opts: Opts = {}): string {
  const key = getGoogleMapsApiKey()
  if (!key) return ''
  const { zoom = 15, width = 600, height = 220, scale = 2 } = opts
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom:   String(zoom),
    size:   `${width}x${height}`,
    scale:  String(scale),
    markers: `color:red|${lat},${lng}`,
    key,
  })
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
}
