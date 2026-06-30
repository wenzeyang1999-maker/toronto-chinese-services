// ─── useImageUpload ─────────────────────────────────────────────────────────
// Shared image picker state for the post forms (Secondhand / RealEstate / Events).
// Previously each form duplicated identical compress + preview + remove logic.
//
// Behaviour is preserved exactly from the original handlers:
//   • validates each file (validateImageFile) before compressing
//   • caps at `maxImages`, silently drops extras
//   • compresses via compressImage, keeps object-URL previews in sync
//   • revokes object URLs on unmount
import { useState, useEffect, useCallback } from 'react'
import { compressImage, validateImageFile } from './compressImage'

export interface ImageUpload {
  images:      File[]
  previews:    string[]
  uploading:   boolean
  error:       string | null
  handleChange:(e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  remove:      (idx: number) => void
  reset:       () => void
}

export function useImageUpload(maxImages: number): ImageUpload {
  const [images,    setImages]    = useState<File[]>([])
  const [previews,  setPreviews]  = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => previews.forEach(URL.revokeObjectURL)
  }, [previews])

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    e.target.value = ''

    const toProcess = files.slice(0, maxImages - images.length)

    for (const file of toProcess) {
      const err = validateImageFile(file)
      if (err) { setError(err); return }
    }

    setUploading(true)
    const compressed   = await Promise.all(toProcess.map((f) => compressImage(f)))
    const newPreviews  = compressed.map((f) => URL.createObjectURL(f))
    setImages((prev) => [...prev, ...compressed])
    setPreviews((prev) => [...prev, ...newPreviews])
    setError(null)
    setUploading(false)
  }, [images.length, maxImages])

  const remove = useCallback((idx: number) => {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[idx])
      return prev.filter((_, i) => i !== idx)
    })
    setImages((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const reset = useCallback(() => {
    setPreviews((prev) => { prev.forEach(URL.revokeObjectURL); return [] })
    setImages([])
    setError(null)
  }, [])

  return { images, previews, uploading, error, handleChange, remove, reset }
}
