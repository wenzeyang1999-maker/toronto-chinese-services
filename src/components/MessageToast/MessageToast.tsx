// ─── MessageToast ─────────────────────────────────────────────────────────────
// Global in-app toast that appears in the top-right when a new chat message
// arrives. Click → navigate to the conversation. Auto-dismisses after 5s.
// Suppressed if the user is already viewing that conversation page.
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

interface Toast {
  id: string
  conversationId: string
  senderName: string
  senderAvatar: string | null
  content: string
}

const TOAST_DURATION_MS = 5000
const MAX_TOASTS        = 3

export default function MessageToast() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const location = useLocation()
  const [toasts, setToasts] = useState<Toast[]>([])

  // Keep latest pathname accessible inside the realtime callback closure
  const pathRef = useRef(location.pathname)
  useEffect(() => { pathRef.current = location.pathname }, [location.pathname])

  useEffect(() => {
    if (!user) { setToasts([]); return }

    const channel = supabase
      .channel(`message-toast-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new as { id: string; conversation_id: string; sender_id: string; content: string }
        if (!msg || msg.sender_id === user.id) return

        // Confirm the conversation includes me
        const { data: conv } = await supabase
          .from('conversations')
          .select('id, client_id, provider_id')
          .eq('id', msg.conversation_id)
          .single()
        if (!conv || (conv.client_id !== user.id && conv.provider_id !== user.id)) return

        // Suppress if I'm already viewing this conversation
        if (pathRef.current === `/conversation/${conv.id}`) return

        // Fetch sender info
        const { data: sender } = await supabase
          .from('users')
          .select('name, avatar_url')
          .eq('id', msg.sender_id)
          .single()

        const toast: Toast = {
          id:             msg.id,
          conversationId: conv.id,
          senderName:     sender?.name ?? '新消息',
          senderAvatar:   sender?.avatar_url ?? null,
          content:        msg.content,
        }

        setToasts(prev => [toast, ...prev.filter(t => t.id !== toast.id)].slice(0, MAX_TOASTS))
        window.setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toast.id))
        }, TOAST_DURATION_MS)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  function dismiss(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  function open(t: Toast) {
    dismiss(t.id)
    navigate(`/conversation/${t.conversationId}`)
  }

  if (!user || toasts.length === 0) return null

  return (
    <div className="fixed top-20 right-4 z-[55] flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-2rem)]">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 60, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="pointer-events-auto"
          >
            <button
              onClick={() => open(t)}
              className="flex items-start gap-3 bg-white border border-gray-200 shadow-xl rounded-2xl
                         p-3.5 w-80 text-left hover:shadow-2xl hover:border-primary-200 transition-all
                         active:scale-[0.98]"
            >
              <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 overflow-hidden ring-2 ring-primary-100">
                {t.senderAvatar
                  ? <img src={t.senderAvatar} alt="" className="w-full h-full object-cover" />
                  : <MessageSquare size={18} className="text-primary-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-gray-900 truncate flex-1">{t.senderName}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 font-bold flex-shrink-0">
                    新消息
                  </span>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{t.content}</p>
              </div>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); dismiss(t.id) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); dismiss(t.id) } }}
                className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 -mt-0.5 cursor-pointer"
                aria-label="关闭"
              >
                <X size={14} />
              </span>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
