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

// ⚠️ 止血开关 (2026-07-31)：/api/img Vercel 函数当前未成功部署(线上返回
// x-vercel-error: NOT_FOUND),导致全站经代理的图片 404、满屏裂图。设为 false 后
// cdnUrl 直接返回 Supabase 公开 URL(图片立刻恢复,仅暂时失去 egress 缩图优化)。
// 待 Vercel 上 api/img 函数修好(多半是 sharp 打包问题)后，改回 true 即恢复代理。
const PROXY_ENABLED = false

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
  const params = [width ? `w=${width}` : '', t ? `v=${t}` : ''].filter(Boolean).join('&')
  return `/api/img/${path}${params ? `?${params}` : ''}`
}
