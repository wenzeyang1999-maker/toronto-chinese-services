// ─── Client-side image validation + compression ───────────────────────────────
// Uses Canvas API to resize + re-encode images before upload.
// Shrinks the longer edge and lowers JPEG quality until the file is
// under `maxBytes`. Falls back to the original file if compression fails.
import { normalizeHeic } from './heic'

// Display-oriented targets. Originals are only ever shown on detail pages, and
// the /api/img proxy downsizes further for list thumbnails — so there's no reason
// to keep multi-MB uploads. 1280px @ ~400KB looks sharp on phones and cuts image
// egress ~3-5x vs the old 1920px / 2.5MB ceiling.
const MAX_EDGE    = 1280   // max width or height in px
const MIN_QUALITY = 0.5    // never go below 50% JPEG quality
const DEFAULT_MAX_BYTES = 400 * 1024   // 400 KB

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']

// Returns an error string if the file is invalid, or null if OK.
export function validateImageFile(file: File): string | null {
  const okType    = ALLOWED_TYPES.includes(file.type) || file.type.startsWith('image/')
  const okHeicExt = /\.(heic|heif)$/i.test(file.name)   // 部分浏览器给 .heic 的 MIME 为空
  if (!okType && !okHeicExt) {
    return `「${file.name}」不是图片文件，只支持 JPG、PNG、WebP、GIF、HEIC 格式`
  }
  return null
}

/**
 * Center-crops an image to a target aspect ratio (width/height), then compresses.
 * Used for cover photos where a 3:1 portrait image would look stretched.
 */
export async function cropAndCompressImage(
  file: File,
  targetRatio = 3,          // width / height — e.g. 3 means 3:1
  maxBytes    = DEFAULT_MAX_BYTES,
): Promise<File> {
  file = await normalizeHeic(file)   // iPhone HEIC → JPEG，否则 canvas 解不了
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const srcW = img.naturalWidth
      const srcH = img.naturalHeight
      const srcRatio = srcW / srcH

      let sx = 0, sy = 0, sw = srcW, sh = srcH
      if (srcRatio > targetRatio) {
        // Wider than target → crop horizontally (keep center)
        sw = Math.round(srcH * targetRatio)
        sx = Math.round((srcW - sw) / 2)
      } else if (srcRatio < targetRatio) {
        // Taller than target → crop vertically (keep top-center)
        sh = Math.round(srcW / targetRatio)
        sy = Math.round((srcH - sh) / 6) // slight upward bias for portraits
      }

      // Output at most 1200 × 400 to keep file size sane
      const outW = Math.min(sw, 1200)
      const outH = Math.round(outW / targetRatio)

      const canvas = document.createElement('canvas')
      canvas.width  = outW
      canvas.height = outH
      canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)

      let quality = 0.85
      const tryEncode = () => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return }
          if (blob.size <= maxBytes || quality <= MIN_QUALITY) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
          } else {
            quality = Math.max(quality - 0.1, MIN_QUALITY)
            tryEncode()
          }
        }, 'image/jpeg', quality)
      }
      tryEncode()
    }

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

export async function compressImage(
  file: File,
  maxBytes = DEFAULT_MAX_BYTES,   // 400 KB — display size, not the 3 MB bucket limit
): Promise<File> {
  file = await normalizeHeic(file)   // iPhone HEIC → JPEG，必须在体积判断前(HEIC 可能本就 <400KB)
  // Already small enough AND likely small-dimension — skip. A large-byte file
  // still gets resized/re-encoded below.
  if (file.size <= maxBytes) return file

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      // Calculate scaled dimensions
      let { width, height } = img
      if (width > MAX_EDGE || height > MAX_EDGE) {
        if (width >= height) {
          height = Math.round((height / width) * MAX_EDGE)
          width  = MAX_EDGE
        } else {
          width  = Math.round((width / height) * MAX_EDGE)
          height = MAX_EDGE
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      // Try decreasing quality until under maxBytes
      let quality = 0.85
      const tryEncode = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return }

            if (blob.size <= maxBytes || quality <= MIN_QUALITY) {
              // Done — wrap blob back into a File
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
            } else {
              quality = Math.max(quality - 0.1, MIN_QUALITY)
              tryEncode()
            }
          },
          'image/jpeg',
          quality,
        )
      }

      tryEncode()
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)   // fallback: upload original
    }

    img.src = url
  })
}
