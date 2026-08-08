// ─── 全局图片编辑器(内测#4) ──────────────────────────────────────────────────
// 提供 Promise 式命令：editImage(file, {aspect}) 打开裁剪弹窗，返回裁剪后的 File，
// 用户取消则返回 null。各上传处只需 `const f = await editImage(file, {aspect}); if(!f) return`。
// ImageEditorHost 挂在 App 根部渲染当前待编辑项；多张图排队逐张编辑。
import { create } from 'zustand'
import { normalizeHeic } from '../lib/heic'

export interface EditOpts { aspect?: number | null }   // 1=1:1(头像) 3=3:1(封面) null=自由

interface Pending {
  file: File
  src: string
  aspect: number | null
  resolve: (result: File | null) => void
}

interface ImageEditorState {
  current: Pending | null
  editImage: (file: File, opts?: EditOpts) => Promise<File | null>
  finish: (result: File | null) => void
}

const queue: Pending[] = []

export const useImageEditorStore = create<ImageEditorState>((set, get) => ({
  current: null,

  editImage: async (file, opts = {}) => {
    // HEIC 先转 JPEG，否则编辑器里 <img> 显示不出来。
    const normalized = await normalizeHeic(file)
    const src = URL.createObjectURL(normalized)
    return new Promise<File | null>((resolve) => {
      const pending: Pending = { file: normalized, src, aspect: opts.aspect ?? null, resolve }
      if (get().current) queue.push(pending)
      else set({ current: pending })
    })
  },

  finish: (result) => {
    const cur = get().current
    if (cur) { URL.revokeObjectURL(cur.src); cur.resolve(result) }
    set({ current: queue.shift() ?? null })
  },
}))
