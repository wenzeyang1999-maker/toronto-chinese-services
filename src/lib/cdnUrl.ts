// ─── Route Supabase Storage images through the Vercel edge proxy ──────────────
// Rewrites a Supabase public storage URL to our /api/img proxy, which caches at
// the Vercel edge (repeat views don't hit Supabase egress) and optionally
// downsizes on the fly. Pass a width for list thumbnails; omit it for originals.
//
//   cdnUrl(url, 400)  → /api/img/<bucket>/<path>?w=400   (small WebP thumbnail)
//   cdnUrl(url)       → /api/img/<bucket>/<path>          (full-size, still cached)
//
// Non-storage URLs (Google avatars, data:, blob:, already-proxied) pass through
// untouched. In `vite dev` there are no Vercel functions, so we return the
// original URL to keep local development working.

const STORAGE_RE = /\/storage\/v1\/object\/public\/([^?]+)/

export function cdnUrl(url: string | null | undefined, width?: number): string {
  if (!url) return ''
  const m = url.match(STORAGE_RE)
  if (!m) return url                       // external / data / blob URL — leave alone
  if (import.meta.env.DEV) return url      // no /api functions under vite dev
  const path = m[1]                        // "<bucket>/<object/path>" (percent-encoded)
  // Avatars/covers upsert to a FIXED path, so the app appends ?t=<ms> on update.
  // Carry it through as ?v so the edge cache key changes when the image changes —
  // otherwise the 1-year immutable cache would freeze the old avatar/cover.
  const t = url.match(/[?&]t=(\d+)/)?.[1]
  const params = [width ? `w=${width}` : '', t ? `v=${t}` : ''].filter(Boolean).join('&')
  return `/api/img/${path}${params ? `?${params}` : ''}`
}
