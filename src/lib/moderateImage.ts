// ─── Image moderation client ─────────────────────────────────────────────────
// Resizes an image to a small (~512px) JPEG thumbnail, base64-encodes it, and
// sends it to the moderate-content edge function (qwen vision) to detect
// porn / gore / violence before the real (full-size) upload + publish.
//
// Small thumbnail = far fewer vision tokens = cheaper + more images/day within
// the Groq free-tier token budget. Moderation doesn't need high resolution.
//
// Fail-open everywhere: any error (offline, rate-limited, timeout) returns
// { pass: true } so a moderation hiccup never blocks a legitimate upload.
import { supabase } from './supabase'
import type { ModerationResult } from '../hooks/useContentModeration'

const MODERATION_EDGE = 512   // longest edge sent to the vision model
const JPEG_QUALITY    = 0.7

function toThumbnailDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) { resolve(null); return }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > MODERATION_EDGE || height > MODERATION_EDGE) {
        if (width >= height) { height = Math.round((height / width) * MODERATION_EDGE); width = MODERATION_EDGE }
        else                 { width  = Math.round((width / height) * MODERATION_EDGE); height = MODERATION_EDGE }
      }
      try {
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
      } catch { resolve(null) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

/** Moderate one image file. Fail-open on any error. */
export async function moderateImage(file: File): Promise<ModerationResult> {
  try {
    const imageDataUrl = await toThumbnailDataUrl(file)
    if (!imageDataUrl) return { pass: true }
    const { data, error } = await supabase.functions.invoke<ModerationResult>('moderate-content', {
      body: { imageDataUrl },
    })
    if (error || !data) return { pass: true }
    return data
  } catch {
    return { pass: true }
  }
}

/** Moderate several images; returns the first failure, else pass. */
export async function moderateImages(files: File[]): Promise<ModerationResult> {
  for (const f of files) {
    const r = await moderateImage(f)
    if (!r.pass) return r
  }
  return { pass: true }
}
