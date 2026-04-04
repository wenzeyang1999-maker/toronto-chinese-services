// ─── ShareButton ──────────────────────────────────────────────────────────────
// Uses Web Share API if available, otherwise copies link to clipboard.
import { useState } from 'react'
import { Share2, Check } from 'lucide-react'

interface Props {
  title: string
  size?: number
  className?: string
}

export default function ShareButton({ title, size = 20, className = '' }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleShare(e: React.MouseEvent) {
    e.stopPropagation()
    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        alert(`链接：${url}`)
      }
    }
  }

  return (
    <button
      onClick={handleShare}
      aria-label="分享"
      className={`flex items-center justify-center rounded-full transition-all active:scale-90 ${className}`}
    >
      {copied
        ? <Check size={size} className="text-green-500" />
        : <Share2 size={size} className="text-gray-400 hover:text-primary-500 transition-colors" />
      }
    </button>
  )
}
