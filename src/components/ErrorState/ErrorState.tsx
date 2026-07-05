// ─── ErrorState ───────────────────────────────────────────────────────────────
// Full-panel "load failed" placeholder with a persistent retry button.
// Use this instead of the empty-state ("暂无内容") when a fetch actually failed —
// otherwise a network error looks identical to "there's genuinely nothing here".
import { CloudOff, RotateCw } from 'lucide-react'
import { useState } from 'react'

interface Props {
  onRetry: () => Promise<unknown> | void
  message?: string
}

export default function ErrorState({ onRetry, message = '加载失败，请检查网络' }: Props) {
  const [retrying, setRetrying] = useState(false)

  async function handleRetry() {
    if (retrying) return
    setRetrying(true)
    try { await onRetry() } finally { setRetrying(false) }
  }

  return (
    <div className="text-center py-20 text-gray-400">
      <CloudOff size={40} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm font-medium text-gray-500">{message}</p>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary-600 bg-primary-50
                   border border-primary-100 rounded-xl px-4 py-2 font-medium
                   hover:bg-primary-100 transition-colors disabled:opacity-60"
      >
        <RotateCw size={13} className={retrying ? 'animate-spin' : ''} />
        {retrying ? '重试中…' : '点击重试'}
      </button>
    </div>
  )
}
