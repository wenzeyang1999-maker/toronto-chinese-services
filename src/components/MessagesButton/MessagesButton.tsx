import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

export default function MessagesButton() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const location = useLocation()
  const [unread, setUnread] = useState(0)

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

  const fetchUnread = useCallback(async () => {
    if (!user) {
      setUnread(0)
      return
    }

    const { data } = await supabase
      .from('conversations')
      .select('client_unread, provider_unread, client_id')
      .or(`client_id.eq.${user.id},provider_id.eq.${user.id}`)

    if (!data) return

    const total = data.reduce((sum, row) => {
      const mine = row.client_id === user.id ? row.client_unread : row.provider_unread
      return sum + (mine ?? 0)
    }, 0)
    setUnread(total)
  }, [user])

  useEffect(() => {
    fetchUnread()
  }, [location.pathname, fetchUnread])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('global-unread')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, fetchUnread)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, fetchUnread])

  if (!user) return null

  return (
    <div className="fixed bottom-44 right-5 lg:bottom-24 lg:right-16 z-50">
      <button
        onClick={() => navigate('/profile?section=messages')}
        className="relative flex items-center gap-2 bg-white shadow-lg border border-gray-200
                   text-primary-600 rounded-full px-4 py-3
                   hover:bg-gray-50 active:scale-95 transition-all"
        aria-label="消息"
      >
        <MessageSquare size={20} />
        <span className="text-sm font-semibold whitespace-nowrap">消息</span>
        {unread > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>
    </div>
  )
}
