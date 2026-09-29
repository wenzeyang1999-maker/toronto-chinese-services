import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Mascot from '../Mascot/Mascot'
import { useAuthStore } from '../../store/authStore'
import { useUnreadCount } from '../../store/unreadStore'

interface Props { grouped?: boolean }

export default function MessagesButton({ grouped }: Props) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const unread = useUnreadCount()   // 全局共享:一个频道 + 一次查询,与 BottomNav 共用

  // Tab title badge + flashing when unread > 0
  // Safari throttles setInterval in background tabs, so we ALSO update the title
  // immediately (Safari will display the latest title even for inactive tabs).
  const originalTitleRef = useRef<string>('')
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!originalTitleRef.current) {
      const cleaned = document.title.replace(/^\(\d+\)\s*💬\s*新消息\s*·\s*/, '')
      originalTitleRef.current = cleaned
    }
    const original = originalTitleRef.current
    const badged   = `(${unread}) 💬 新消息 · ${original}`

    let intervalId: number | undefined
    let toggle = true

    const stopFlash = () => {
      if (intervalId) { window.clearInterval(intervalId); intervalId = undefined }
    }

    const apply = () => {
      stopFlash()
      if (unread <= 0) {
        document.title = original
        return
      }
      // Always show badge first — Safari relies on this single update.
      document.title = badged
      // Foreground & some browsers: animate by toggling between badge and plain.
      if (!document.hidden) {
        intervalId = window.setInterval(() => {
          toggle = !toggle
          document.title = toggle ? badged : original
        }, 1200)
      }
    }

    apply()
    document.addEventListener('visibilitychange', apply)
    return () => {
      document.removeEventListener('visibilitychange', apply)
      stopFlash()
      document.title = original
    }
  }, [unread])

  if (!user) return null

  const btn = (
    <button
      onClick={() => navigate('/profile?section=messages')}
      className="relative flex items-center gap-2 bg-white border border-gray-100
                 text-primary-600 rounded-full px-4 py-3
                 hover:bg-gray-50 active:scale-95 transition-all"
      style={{ boxShadow: '0 8px 28px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.07)' }}
      aria-label="消息"
    >
      <Mascot pose="hello" size={40} className="flex-shrink-0 -my-2" />
      <span className="text-sm font-semibold whitespace-nowrap">消息</span>
      {unread > 0 && (
        <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
      )}
    </button>
  )

  if (grouped) return btn

  return (
    <div className="fixed bottom-44 right-5 lg:bottom-24 lg:right-16 z-50">
      {btn}
    </div>
  )
}
