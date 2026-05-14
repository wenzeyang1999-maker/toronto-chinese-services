// ─── Messages Section (Inbox) ─────────────────────────────────────────────────
// Shows all conversations for the current user, sorted by last message time.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MessageSquare, ChevronRight } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { SectionSkeleton } from '../../../components/Skeleton/Skeleton'

interface ConvRow {
  id: string
  client_id: string
  provider_id: string
  last_message: string | null
  last_message_at: string
  client_unread: number
  provider_unread: number
  service: { title: string } | null
  other: { name: string } | null
}

export default function MessagesSection() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [convs, setConvs] = useState<ConvRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    function load() {
      Promise.resolve(
        supabase
          .from('conversations')
          .select(`id, client_id, provider_id, last_message, last_message_at, client_unread, provider_unread,
                   service:services(title),
                   client:users!conversations_client_id_fkey(name),
                   provider:users!conversations_provider_id_fkey(name)`)
          .or(`client_id.eq.${user!.id},provider_id.eq.${user!.id}`)
          .order('last_message_at', { ascending: false })
      ).then(({ data, error }) => {
        if (!error && data) {
          setConvs(data.map((row) => {
            const isClient = row.client_id === user!.id
            return {
              ...row,
              service: Array.isArray(row.service) ? row.service[0] : row.service,
              other:   isClient
                ? (Array.isArray(row.provider) ? row.provider[0] : row.provider)
                : (Array.isArray(row.client)   ? row.client[0]   : row.client),
            }
          }))
        }
        setLoading(false)
      }).catch(() => setLoading(false))
    }

    load()

    // Realtime: re-fetch when any conversation updates (unread reset, new message)
    const channel = supabase
      .channel('messages-section')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, load)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  if (loading) return <SectionSkeleton rows={4} />

  if (convs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-8 text-center">
        <span className="text-5xl mb-2 select-none">💬</span>
        <p className="text-base font-semibold text-gray-700">还没有消息</p>
        <p className="text-sm text-gray-400 leading-relaxed">在服务详情页点击「发消息」<br />即可和服务商开始对话</p>
        <button
          onClick={() => navigate('/')}
          className="mt-3 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
        >
          去浏览服务
        </button>
      </div>
    )
  }

  return (
    <motion.div
      key="messages"
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}
      className="flex-1 px-4 py-4 max-w-md lg:max-w-none mx-auto w-full"
    >
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
        {convs.map((conv) => {
          const isClient  = conv.client_id === user!.id
          const unread    = isClient ? conv.client_unread : conv.provider_unread
          const timeLabel = conv.last_message_at
            ? new Date(conv.last_message_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
            : ''

          return (
            <button
              key={conv.id}
              onClick={() => navigate(`/conversation/${conv.id}`)}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
            >
              {/* Avatar placeholder */}
              <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <span className="text-base font-bold text-primary-600">
                  {conv.other?.name?.charAt(0) ?? '?'}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800 truncate">
                    {conv.other?.name ?? '未知用户'}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{timeLabel}</span>
                </div>
                {conv.service?.title && (
                  <p className="text-xs text-primary-500 truncate">{conv.service.title}</p>
                )}
                <p className="text-xs text-gray-400 truncate mt-0.5">
                  {conv.last_message ?? '暂无消息'}
                </p>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {unread > 0 && (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
                <ChevronRight size={16} className="text-gray-300" />
              </div>
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}
