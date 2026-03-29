// ─── Client-side image validation + compression ───────────────────────────────
// Uses Canvas API to resize + re-encode images before upload.
// Shrinks the longer edge and lowers JPEG quality until the file is
// under `maxBytes`. Falls back to the original file if compression fails.

const MAX_EDGE    = 1920   // max width or height in px
const MIN_QUALITY = 0.5    // never go below 50% JPEG quality

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']

// Returns an error string if the file is invalid, or null if OK.
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
    return `「${file.name}」不是图片文件，只支持 JPG、PNG、WebP、GIF 格式`
  }
  return null
}

export async function compressImage(
  file: File,
  maxBytes = 2.5 * 1024 * 1024,   // 2.5 MB — safely under the 3 MB bucket limit
): Promise<File> {
  // Already small enough — skip
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
