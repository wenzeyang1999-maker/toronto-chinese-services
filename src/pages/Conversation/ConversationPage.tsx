// ─── Conversation Page ────────────────────────────────────────────────────────
// Route: /conversation/:id
// Real-time chat between client and provider, with offline contact info.
import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, Send, Phone, MessageCircle, Copy } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { notifyNewMessage } from '../../lib/notify'

interface Message {
  id: string
  sender_id: string
  content: string
  created_at: string
}

interface ConvInfo {
  id: string
  client_id: string
  provider_id: string
  service_id: string | null
  service?: { title: string } | null
  other?: { name: string; phone: string | null; wechat: string | null } | null
}

export default function ConversationPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const [conv,     setConv]     = useState<ConvInfo | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input,    setInput]    = useState('')
  const [sending,  setSending]  = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (!user) navigate('/login') }, [user, navigate])

  // Load conversation info + messages
  useEffect(() => {
    if (!id || !user) return

    supabase
      .from('conversations')
      .select(`id, client_id, provider_id, service_id,
               service:services(title),
               client:users!conversations_client_id_fkey(name, phone, wechat),
               provider:users!conversations_provider_id_fkey(name, phone, wechat)`)
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return
        const isClient = data.client_id === user.id
        setConv({
          ...data,
          service: Array.isArray(data.service) ? data.service[0] : data.service,
          other:   isClient
            ? (Array.isArray(data.provider) ? data.provider[0] : data.provider)
            : (Array.isArray(data.client)   ? data.client[0]   : data.client),
        })
        // Reset unread count for current user
        const col = isClient ? 'client_unread' : 'provider_unread'
        supabase.from('conversations').update({ [col]: 0 }).eq('id', id).then()
      })

    supabase
      .from('messages')
      .select('id, sender_id, content, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => { if (!error && data) setMessages(data) })
  }, [id, user])

  // Realtime subscription
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`conv-${id}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'messages',
        filter: `conversation_id=eq.${id}`,
      }, payload => {
        const incoming = payload.new as Message
        setMessages(prev =>
          prev.some(m => m.id === incoming.id) ? prev : [...prev, incoming]
        )
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || !id || !user || !conv) return
    setSending(true)
    setInput('')

    // Optimistic update — show immediately without waiting for realtime
    const tempId = `temp-${Date.now()}`
    const optimistic: Message = {
      id: tempId,
      sender_id: user.id,
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    const { data: inserted, error } = await supabase.from('messages').insert({
      conversation_id: id,
      sender_id:       user.id,
      content:         text,
    }).select('id').single()

    if (!error) {
      // Replace temp message with real ID so realtime duplicate is ignored
      if (inserted) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: inserted.id } : m))
      }
      const isClient = conv.client_id === user.id
      const unreadCol = isClient ? 'provider_unread' : 'client_unread'

      // If the provider just replied, update their avg_reply_hours.
      // Find the earliest client message in this conversation and compute elapsed hours.
      if (!isClient) {
        const firstClientMsg = messages.find(m => m.sender_id === conv.client_id)
        if (firstClientMsg) {
          const elapsedHours =
            (Date.now() - new Date(firstClientMsg.created_at).getTime()) / 3_600_000
          // Rolling average: fetch current value and blend (weight 0.3 new, 0.7 old)
          supabase.from('users').select('avg_reply_hours').eq('id', user.id).single()
            .then(({ data }) => {
              const prev = data?.avg_reply_hours
              const next = prev != null
                ? Math.round((prev * 0.7 + elapsedHours * 0.3) * 10) / 10
                : Math.round(elapsedHours * 10) / 10
              supabase.from('users').update({ avg_reply_hours: next }).eq('id', user.id).then()
            })
        }
      }
      const { data: cur } = await supabase
        .from('conversations').select(unreadCol).eq('id', id).single()
      const currentCount = (cur as Record<string, number> | null)?.[unreadCol] ?? 0
      await supabase.from('conversations').update({
        last_message:    text,
        last_message_at: new Date().toISOString(),
        [unreadCol]: currentCount + 1,
      }).eq('id', id)

      // Fire-and-forget email notification to the other party
      const recipientId = isClient ? conv.provider_id : conv.client_id
      supabase.from('users').select('email, name').eq('id', recipientId).single()
        .then(({ data }) => {
          if (!data?.email) return
          notifyNewMessage({
            recipientEmail: data.email,
            recipientName:  data.name ?? '用户',
            senderName:     user.user_metadata?.name ?? user.email ?? '用户',
            preview:        text,
            conversationId: id!,
          })
        })
    } else {
      // Rollback optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setInput(text)
    }
    setSending(false)
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  async function copyWechat() {
    if (!conv?.other?.wechat) return
    try {
      await navigator.clipboard.writeText(conv.other.wechat)
      alert(`微信号已复制：${conv.other.wechat}`)
    } catch {
      alert(`微信号：${conv.other.wechat}`)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-100 lg:flex lg:items-start lg:justify-center lg:py-6">
    <div className="bg-gray-50 flex flex-col min-h-screen lg:min-h-0 lg:h-[90vh] lg:w-full lg:max-w-2xl lg:rounded-2xl lg:shadow-xl lg:overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/profile?section=messages')} className="text-gray-500 hover:text-gray-800">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">
            {conv?.other?.name ?? '对话'}
          </p>
          {conv?.service?.title && (
            <p className="text-xs text-gray-400 truncate">{conv.service.title}</p>
          )}
        </div>

        {/* Offline contact buttons */}
        {conv?.other?.phone && (
          <a href={`tel:${conv.other.phone}`}
            className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center hover:bg-primary-100 transition-colors">
            <Phone size={16} className="text-primary-600" />
          </a>
        )}
        {conv?.other?.wechat && (
          <button onClick={copyWechat}
            className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center hover:bg-green-100 transition-colors">
            <MessageCircle size={16} className="text-green-600" />
          </button>
        )}
      </div>

      {/* Offline contact hint */}
      {(conv?.other?.phone || conv?.other?.wechat) && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2">
          <p className="text-xs text-blue-600 flex-1">
            可直接联系：
            {conv.other?.phone && <span className="font-medium ml-1">📞 {conv.other.phone}</span>}
            {conv.other?.wechat && <span className="font-medium ml-2">💬 {conv.other.wechat}</span>}
          </p>
          {conv.other?.wechat && (
            <button onClick={copyWechat} className="text-xs text-blue-500 flex items-center gap-1">
              <Copy size={11} /> 复制微信
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm pt-8">
            发送第一条消息开始对话
          </div>
        )}
        {messages.map(msg => {
          const isMine = msg.sender_id === user.id
          return (
            <motion.div key={msg.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                ${isMine
                  ? 'bg-primary-600 text-white rounded-tr-sm'
                  : 'bg-white text-gray-800 border border-gray-100 shadow-sm rounded-tl-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-xs mt-1 ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </motion.div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 px-3 py-3 flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="输入消息…"
          rows={1}
          disabled={sending}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5
                     text-sm text-gray-800 placeholder-gray-400
                     focus:outline-none focus:ring-2 focus:ring-primary-300
                     disabled:opacity-60 max-h-28"
        />
        <button onClick={sendMessage} disabled={sending || !input.trim()}
          className="w-9 h-9 flex-shrink-0 rounded-xl bg-primary-600 hover:bg-primary-700
                     disabled:bg-gray-200 text-white flex items-center justify-center
                     transition-colors active:scale-95">
          <Send size={16} />
        </button>
      </div>
    </div>
    </div>
  )
}
