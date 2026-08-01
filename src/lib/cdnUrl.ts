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

// 代理开关。2026-07-31 曾因 /api/img 函数未部署(catch-all [...path] 路由不被
// 裸 Vite /api 识别)导致全站裂图,临时置 false 止血;函数改为静态路由 api/img.ts
// (?path= 查询参数)后已验证正常(200 + sharp WebP 缩图),故恢复为 true。
const PROXY_ENABLED = true

export function cdnUrl(url: string | null | undefined, width?: number): string {
  if (!url) return ''
  const m = url.match(STORAGE_RE)
  if (!m) return url                       // external / data / blob URL — leave alone
  if (import.meta.env.DEV || !PROXY_ENABLED) return url   // dev / 代理停用 → 直连 Supabase
  const path = m[1]                        // "<bucket>/<object/path>" (percent-encoded)
  // Avatars/covers upsert to a FIXED path, so the app appends ?t=<ms> on update.
  // Carry it through as ?v so the edge cache key changes when the image changes —
  // otherwise the 1-year immutable cache would freeze the old avatar/cover.
  const t = url.match(/[?&]t=(\d+)/)?.[1]
  const extra = [width ? `w=${width}` : '', t ? `v=${t}` : ''].filter(Boolean).join('&')
  return `/api/img?path=${path}${extra ? `&${extra}` : ''}`
}
