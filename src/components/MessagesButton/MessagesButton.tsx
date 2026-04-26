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

  // Tab title flashing when unread > 0 and tab not focused
  const originalTitleRef = useRef<string>('')
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!originalTitleRef.current) originalTitleRef.current = document.title

    let intervalId: number | undefined
    let toggle = false

    const stopFlash = () => {
      if (intervalId) { window.clearInterval(intervalId); intervalId = undefined }
      document.title = originalTitleRef.current
    }

    const startFlash = () => {
      if (intervalId) return
      intervalId = window.setInterval(() => {
        toggle = !toggle
        document.title = toggle
          ? `(${unread}) 💬 新消息`
          : originalTitleRef.current
      }, 1200)
    }

    const update = () => {
      if (unread > 0 && document.hidden) startFlash()
      else stopFlash()
    }

    update()
    document.addEventListener('visibilitychange', update)
    return () => {
      document.removeEventListener('visibilitychange', update)
      stopFlash()
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
