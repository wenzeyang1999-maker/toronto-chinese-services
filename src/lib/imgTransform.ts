// ─── Supabase Image Transform Helper ─────────────────────────────────────────
// Appends Supabase Storage transformation params to storage URLs.
// For non-Supabase URLs (e.g. external links) returns the original URL unchanged.

const SUPABASE_STORAGE_MARKER = '/storage/v1/object/public/'

/**
 * Returns a resized/compressed version of a Supabase storage image URL.
 * @param url   Original image URL
 * @param width Target width in pixels
 * @param quality JPEG quality 1–100 (default 80)
 */
export function imgUrl(url: string | null | undefined, width: number, quality = 80): string {
  if (!url) return ''
  if (!url.includes(SUPABASE_STORAGE_MARKER)) return url
  // Supabase image transform: /storage/v1/render/image/public/<bucket>/<path>?width=&quality=
  const transformed = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/',
  )
  const sep = transformed.includes('?') ? '&' : '?'
  return `${transformed}${sep}width=${width}&quality=${quality}`
}

/** Thumbnail size — used in list cards */
export const thumb = (url: string | null | undefined) => imgUrl(url, 400)

/** Medium size — used in detail page gallery */
export const medium = (url: string | null | undefined) => imgUrl(url, 900)
