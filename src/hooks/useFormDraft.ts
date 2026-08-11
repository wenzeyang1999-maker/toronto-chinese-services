// ─── useFormDraft(内测#2:草稿自动保存) ───────────────────────────────────────
// 把发布表单的文本字段自动存到 localStorage,填写中被打断(验证手机/邮箱、来电、
// 切走)回来后自动恢复,不用重写。图片等非文本状态不在 form 里,不受影响。
//   • 输入变化 500ms 防抖后保存(带时间戳)
//   • 挂载时恢复 24 小时内的草稿(过期自动清)
//   • 提交成功后调用 clearDraft() 清掉
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '../lib/toast'

const MAX_AGE_MS = 24 * 60 * 60 * 1000   // 草稿最长保留 24 小时

export function useFormDraft<T extends object>(
  key: string,
  form: T,
  setForm: (updater: (prev: T) => T) => void,
) {
  const [restored, setRestored] = useState(false)
  const loaded = useRef(false)

  // 恢复(仅一次)
  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return
      const parsed = JSON.parse(raw) as { savedAt?: number; data?: Partial<T> }
      if (!parsed?.data || (parsed.savedAt && Date.now() - parsed.savedAt > MAX_AGE_MS)) {
        localStorage.removeItem(key)
        return
      }
      setForm((prev) => ({ ...prev, ...parsed.data }))
      setRestored(true)
      toast('已恢复上次未完成的草稿', 'info')
    } catch { /* ignore malformed draft */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // 防抖保存
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data: form })) } catch { /* quota */ }
    }, 500)
    return () => clearTimeout(t)
  }, [form, key])

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(key) } catch { /* ignore */ }
    setRestored(false)
  }, [key])

  return { restored, clearDraft }
}
