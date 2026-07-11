import { useCallback, useState } from 'react'
import { toast } from '../lib/toast'

// One place for "copy to clipboard" — replaces the ~20 hand-rolled copy handlers
// (WeChat ids, share links). Supports both UI shapes:
//   • inline "已复制" flag  → const { copied, copy } = useCopy(); ... copy(text)
//   • toast on success      → copy(text, { toastMsg: '微信号已复制 ✓' })
// On failure it toasts the value so the user can copy by hand.
export function useCopy(resetMs = 2000) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(
    async (text: string | null | undefined, opts?: { toastMsg?: string; fallback?: string }) => {
      if (!text) return false
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), resetMs)
        if (opts?.toastMsg) toast(opts.toastMsg, 'success')
        return true
      } catch {
        toast(opts?.fallback ?? `${text}（请手动复制）`)
        return false
      }
    },
    [resetMs],
  )

  return { copied, copy }
}
