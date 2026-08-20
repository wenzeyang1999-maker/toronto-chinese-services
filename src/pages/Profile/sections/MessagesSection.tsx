// ─── Messages Section (Inbox) ─────────────────────────────────────────────────
// Shows all conversations for the current user, sorted by last message time.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Mascot from '../../../components/Mascot/Mascot'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { toast } from '../../../lib/toast'
import { SectionSkeleton } from '../../../components/Skeleton/Skeleton'

interface ConvRow {
  id: string
  client_id: string
  provider_id: string
  last_message: string | null
  last_message_at: string
  client_unread: number
  provider_unread: number
  client_hidden_at: string | null
  provider_hidden_at: string | null
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
                   client_hidden_at, provider_hidden_at,
                   service:services(title),
                   client:users!conversations_client_id_fkey(name),
                   provider:users!conversations_provider_id_fkey(name)`)
          .or(`client_id.eq.${user!.id},provider_id.eq.${user!.id}`)
          .order('last_message_at', { ascending: false })
      ).then(({ data, error }) => {
        if (!error && data) {
          const rows = data.map((row) => {
            const isClient = row.client_id === user!.id
            return {
              ...row,
              service: Array.isArray(row.service) ? row.service[0] : row.service,
              other:   isClient
                ? (Array.isArray(row.provider) ? row.provider[0] : row.provider)
                : (Array.isArray(row.client)   ? row.client[0]   : row.client),
            }
          }).filter((row) => {
            // 已删除(隐藏)的会话:除非之后又来了新消息,否则不显示
            const isClient = row.client_id === user!.id
            const hiddenAt = isClient ? row.client_hidden_at : row.provider_hidden_at
            if (!hiddenAt) return true
            if (!row.last_message_at) return false
            return new Date(row.last_message_at).getTime() > new Date(hiddenAt).getTime()
          })
          setConvs(rows as ConvRow[])
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

  async function hideConv(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('删除这条会话？（对方再发新消息会重新出现）')) return
    const { error } = await supabase.rpc('hide_conversation', { p_conversation_id: id })
    if (error) { toast(error.message || '删除失败', 'error'); return }
    setConvs((prev) => prev.filter((c) => c.id !== id))
  }

  async function hideAll() {
    if (convs.length === 0) return
    if (!window.confirm('清空全部会话？（对方再发新消息会重新出现）')) return
    const { error } = await supabase.rpc('hide_all_conversations')
    if (error) { toast(error.message || '清空失败', 'error'); return }
    setConvs([])
    toast('已清空全部会话', 'success')
  }

  if (loading) return <SectionSkeleton rows={4} />

  if (convs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-8 text-center">
        <Mascot pose="sleep" size={112} className="mb-1" />
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
      {/* 一键清空(内测0818 四) */}
      <div className="flex justify-end mb-2">
        <button onClick={hideAll}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 size={13} /> 全部删除
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
        {convs.map((conv) => {
          const isClient  = conv.client_id === user!.id
          const unread    = isClient ? conv.client_unread : conv.provider_unread
          const timeLabel = conv.last_message_at
            ? new Date(conv.last_message_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
            : ''

          return (
            <div key={conv.id} className="flex items-stretch hover:bg-gray-50 transition-colors">
              <button
                onClick={() => navigate(`/conversation/${conv.id}`)}
                className="flex-1 flex items-center gap-3 px-4 py-4 active:bg-gray-100 transition-colors text-left min-w-0"
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

                {unread > 0 && (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium flex-shrink-0">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              {/* 删除此会话 */}
              <button onClick={(e) => hideConv(conv.id, e)} aria-label="删除会话"
                className="px-3 flex items-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
