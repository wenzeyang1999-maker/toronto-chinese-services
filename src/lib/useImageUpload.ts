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
import { moderateImage } from './moderateImage'

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
    const compressed = await Promise.all(toProcess.map((f) => compressImage(f)))
    // 图片审核（黄暴血腥）：逐张审，违规的当场剔除并提示；出错/限流一律放行(fail-open)。
    const accepted: File[] = []
    let rejectReason: string | null = null
    for (const f of compressed) {
      const m = await moderateImage(f)
      if (m.pass) accepted.push(f)
      else rejectReason = m.reason ?? '含违规内容'
    }
    if (accepted.length > 0) {
      const newPreviews = accepted.map((f) => URL.createObjectURL(f))
      setImages((prev) => [...prev, ...accepted])
      setPreviews((prev) => [...prev, ...newPreviews])
    }
    setError(rejectReason
      ? (accepted.length > 0 ? `部分图片审核未通过（${rejectReason}），已自动移除` : `图片审核未通过：${rejectReason}`)
      : null)
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
