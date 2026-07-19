// ─── Conversation Page ────────────────────────────────────────────────────────
// Route: /conversation/:id
// Real-time chat between client and provider, with offline contact info.
import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, Send, Phone, MessageCircle, Copy, RotateCcw, Flag, Ban, ImagePlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { notifyNewMessage } from '../../lib/notify'
import { toast } from '../../lib/toast'
import { compressImage } from '../../lib/compressImage'

interface Message {
  id: string
  sender_id: string
  content: string
  created_at: string
  failed?: boolean
}

interface ConvInfo {
  id: string
  client_id: string
  provider_id: string
  service_id: string | null
  service?: { title: string } | null
  other?: { name: string; phone: string | null; wechat: string | null } | null
}

// Compares two ISO timestamps safely (formats may differ: '…Z' vs '…+00:00').
function seenAt(otherLastRead: string | null, createdAt: string): boolean {
  if (!otherLastRead) return false
  return new Date(otherLastRead).getTime() >= new Date(createdAt).getTime()
}

export default function ConversationPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const [conv,         setConv]        = useState<ConvInfo | null>(null)
  const [messages,     setMessages]    = useState<Message[]>([])
  // Timestamp the OTHER party last read this conversation (drives 已读/已送达).
  const [otherLastRead, setOtherLastRead] = useState<string | null>(null)
  const [input,        setInput]       = useState('')
  const [sending,      setSending]     = useState(false)
  // Set when the recipient has blocked us (DB trigger raises 42501). Locks input
  // + suppresses retry so we don't loop forever on a message that can't land.
  const [blockedByOther, setBlockedByOther] = useState(false)
  const [reportOpen,   setReportOpen]  = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportSent,   setReportSent]  = useState(false)
  const [blockOpen,    setBlockOpen]   = useState(false)
  const [marking,      setMarking]     = useState(false)
  const [dealOpen,     setDealOpen]    = useState(false)   // 金额录入弹窗
  const [dealAmount,   setDealAmount]  = useState('')

  // 「标记成交」— create a pending order between the two parties (双向确认)。
  // 金额选填但强烈建议填：amount 是 GMV/客单价的地基（说明书名片墙口径）。
  async function markDeal() {
    if (!id || marking) return
    const amt = dealAmount.trim() === '' ? null : Number(dealAmount)
    if (amt !== null && (!Number.isFinite(amt) || amt < 0)) {
      toast('金额请填写有效数字', 'error'); return
    }
    setMarking(true)
    const { error } = await supabase.rpc('create_order', {
      p_conversation_id: id,
      p_title:  conv?.service?.title ?? null,
      p_amount: amt,
    })
    setMarking(false)
    if (error) { toast(error.message || '发起失败，请重试', 'error'); return }
    setDealOpen(false)
    setDealAmount('')
    toast('已发起成交，等对方确认 ✓', 'success')
  }
  const [blockBusy,    setBlockBusy]   = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)

  useEffect(() => { if (!user) navigate('/login') }, [user, navigate])

  // Load conversation info + messages
  useEffect(() => {
    if (!id || !user) return

    supabase
      .from('conversations')
      .select(`id, client_id, provider_id, service_id,
               client_last_read_at, provider_last_read_at,
               service:services(title),
               client:users!conversations_client_id_fkey(name),
               provider:users!conversations_provider_id_fkey(name)`)
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return
        const isClient = data.client_id === user.id
        const otherName = isClient
          ? (Array.isArray(data.provider) ? data.provider[0] : data.provider)
          : (Array.isArray(data.client)   ? data.client[0]   : data.client)
        const otherId = isClient ? data.provider_id : data.client_id
        setConv({
          ...data,
          service: Array.isArray(data.service) ? data.service[0] : data.service,
          other: { name: (otherName as { name?: string })?.name ?? '', phone: null, wechat: null },
        })
        // Contact of the other party via the authorized RPC (conversation partner).
        supabase.rpc('get_contact', { p_target: otherId }).returns<{ phone: string; wechat: string }[]>().maybeSingle().then(({ data: c }) => {
          const cc = c as { phone?: string; wechat?: string } | null
          if (cc) setConv((prev) => prev ? { ...prev, other: prev.other ? { ...prev.other, phone: cc.phone ?? null, wechat: cc.wechat ?? null } : prev.other } : prev)
        })
        // How far the other party has read (for my own messages' receipts).
        setOtherLastRead((isClient ? data.provider_last_read_at : data.client_last_read_at) ?? null)
        // Reset my unread count + stamp my last-read (this drives the OTHER
        // party's receipts). One update, piggybacked on the existing reset.
        const unreadCol   = isClient ? 'client_unread'        : 'provider_unread'
        const lastReadCol = isClient ? 'client_last_read_at'  : 'provider_last_read_at'
        supabase.from('conversations')
          .update({ [unreadCol]: 0, [lastReadCol]: new Date().toISOString() }).eq('id', id)
          .then(({ error }) => { if (error) console.warn('[conv] unread/read reset failed:', error.message) })
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
    if (!id || !user) return
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
      // Read receipts: when the other side opens the chat, their last_read_at
      // updates → flip my latest message to 已读 in real time.
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'conversations',
        filter: `id=eq.${id}`,
      }, payload => {
        const row = payload.new as { client_id: string; provider_last_read_at: string | null; client_last_read_at: string | null }
        const isClient = row.client_id === user.id
        setOtherLastRead((isClient ? row.provider_last_read_at : row.client_last_read_at) ?? null)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, user?.id])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function retryMessage(msg: Message) {
    setMessages(prev => prev.filter(m => m.id !== msg.id))
    await sendMessage(msg.content)
  }

  async function sendMessage(textOverride?: string) {
    const text = textOverride ?? input.trim()
    if (!text || !id || !user || !conv) return
    setSending(true)
    if (!textOverride) setInput('')

    // Optimistic update — show immediately without waiting for realtime.
    // Random suffix avoids a collision when two messages are sent in the same ms.
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
          ;(async () => {
            const { data, error: fetchErr } = await supabase
              .from('users').select('avg_reply_hours').eq('id', user.id).single()
            if (fetchErr) {
              console.warn('[avg_reply_hours] fetch failed:', fetchErr.message)
              return
            }
            const prev = data?.avg_reply_hours
            const next = prev != null
              ? Math.round((prev * 0.7 + elapsedHours * 0.3) * 10) / 10
              : Math.round(elapsedHours * 10) / 10
            const { error: updateErr } = await supabase
              .from('users').update({ avg_reply_hours: next }).eq('id', user.id)
            if (updateErr) console.warn('[avg_reply_hours] update failed:', updateErr.message)
          })()
        }
      }
      const displayText = text.startsWith('[photo]') ? '[图片]' : text
      await supabase.from('conversations').update({
        last_message:    displayText,
        last_message_at: new Date().toISOString(),
      }).eq('id', id)
      await supabase.rpc('increment_conversation_unread', {
        conv_id:  id,
        col_name: unreadCol,
      })

      // Fire-and-forget email notification to the other party
      const recipientId = isClient ? conv.provider_id : conv.client_id
      notifyNewMessage({
        recipientUserId: recipientId,
        senderName:      user.user_metadata?.name ?? user.email ?? '用户',
        preview:         displayText,
        conversationId:  id!,
      })
    } else {
      // 42501 = the recipient blocked us (raised by the blocked_users trigger).
      const isBlock = error.code === '42501' || /blocked/i.test(error.message ?? '')
      if (isBlock) {
        setBlockedByOther(true)
        setMessages(prev => prev.filter(m => m.id !== tempId))  // drop it — it can never land
        toast('对方已将你拉黑，无法发送消息', 'error')
      } else {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, failed: true } : m))
      }
    }
    setSending(false)
  }

  async function submitBlock() {
    if (!conv || !user) return
    const otherId = conv.client_id === user.id ? conv.provider_id : conv.client_id
    setBlockBusy(true)
    const { error } = await supabase.from('blocked_users').insert({
      blocker_id: user.id,
      blocked_id: otherId,
    })
    setBlockBusy(false)
    if (error && error.code !== '23505') {
      toast('拉黑失败，请稍后再试', 'error')
      return
    }
    toast('已拉黑，对方将无法再给你发消息', 'success')
    setBlockOpen(false)
    navigate('/profile?section=messages')
  }

  async function submitReport() {
    if (!conv || !user || !reportReason.trim()) return
    const otherId = conv.client_id === user.id ? conv.provider_id : conv.client_id
    const otherName = conv.other?.name ?? '对方用户'
    const { error } = await supabase.from('content_reports').insert({
      content_type:  'user',
      content_id:    otherId,
      content_title: `聊天用户：${otherName}`,
      reporter_id:   user.id,
      reason:        reportReason.trim(),
    })
    if (error) {
      toast('举报失败，请稍后再试', 'error')
    } else {
      setReportSent(true)
      toast('举报已提交，我们将尽快处理', 'success')
    }
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !id || !user || !conv) return
    setUploadingPhoto(true)
    try {
      const compressed = await compressImage(file)
      const ext  = compressed.name.split('.').pop() ?? 'jpg'
      const path = `chat-photos/${user.id}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('service-images')
        .upload(path, compressed, { upsert: false })
      if (uploadErr) throw uploadErr
      const { data: { publicUrl } } = supabase.storage.from('service-images').getPublicUrl(path)
      await sendMessage(`[photo]${publicUrl}`)
    } catch (err) {
      console.error('[photo upload]', err)
      toast('图片上传失败，请重试', 'error')
    } finally {
      setUploadingPhoto(false)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  async function copyWechat() {
    if (!conv?.other?.wechat) return
    try {
      await navigator.clipboard.writeText(conv.other.wechat)
      toast('微信号已复制 ✓', 'success')
    } catch {
      toast(`微信号：${conv.other.wechat}（请手动复制）`)
    }
  }

  if (!user) return null

  // Show skeleton until conv metadata arrives
  // The last of my own (successfully sent) messages carries the read receipt.
  let lastMineId: string | null = null
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender_id === user.id && !messages[i].failed) { lastMineId = messages[i].id; break }
  }

  if (!conv) return (
    <div className="min-h-[100dvh] bg-gray-100 lg:flex lg:items-start lg:justify-center lg:py-6">
    <div className="bg-gray-50 flex flex-col h-[var(--app-vh,100dvh)] lg:min-h-0 lg:h-[90vh] lg:w-full lg:max-w-2xl lg:rounded-2xl lg:shadow-xl lg:overflow-hidden">
      <div className="bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3 sticky top-0 z-10 animate-pulse">
        <button onClick={() => navigate(-1)} className="text-gray-500"><ChevronLeft size={22} /></button>
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-gray-200 rounded w-28" />
          <div className="h-3 bg-gray-100 rounded w-20" />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        <div className="animate-pulse space-y-3 px-4 w-full">
          {[80, 60, 75].map((w, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
              <div className="h-10 bg-gray-200 rounded-2xl" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
  )

  return (
    <>
    <div className="min-h-[100dvh] bg-gray-100 lg:flex lg:items-start lg:justify-center lg:py-6">
    <div className="bg-gray-50 flex flex-col h-[var(--app-vh,100dvh)] lg:min-h-0 lg:h-[90vh] lg:w-full lg:max-w-2xl lg:rounded-2xl lg:shadow-xl lg:overflow-hidden">
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
        {conv && conv.client_id !== conv.provider_id && (
          <button onClick={() => setDealOpen(true)} disabled={marking}
            className="flex-shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-primary-600 text-white
                       hover:bg-primary-700 disabled:opacity-60 whitespace-nowrap"
            title="双方确认后计入成交">
            {marking ? '…' : '标记成交'}
          </button>
        )}
        {conv && conv.client_id !== conv.provider_id && (
          <>
            <button onClick={() => setReportOpen(true)}
              className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center hover:bg-red-50 transition-colors"
              title="举报用户">
              <Flag size={15} className="text-gray-400 hover:text-red-500" />
            </button>
            <button onClick={() => setBlockOpen(true)}
              className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center hover:bg-red-50 transition-colors"
              title="拉黑用户">
              <Ban size={15} className="text-gray-400 hover:text-red-500" />
            </button>
          </>
        )}
      </div>

      {/* 身份烙印 — 客户暖色 / 服务商深色，明确当前身份与所谈服务（说明书 §5.1）*/}
      {conv && user && conv.client_id !== conv.provider_id && (() => {
        const isClient = conv.client_id === user.id
        const other = conv.other?.name || '对方'
        const svc = conv.service?.title
        return isClient ? (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 px-4 py-1.5 flex items-center gap-1.5">
            <span>🛒</span>
            <span className="text-xs text-amber-800 truncate">您是<b>客户</b> · 正在向「{other}」咨询{svc ? `「${svc}」` : ''}服务</span>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-slate-800 to-blue-900 border-b border-slate-900 px-4 py-1.5 flex items-center gap-1.5">
            <span>🔧</span>
            <span className="text-xs text-white/90 truncate">您是<b className="text-white">服务商</b> · 正在为「{other}」提供{svc ? `「${svc}」` : ''}服务</span>
          </div>
        )
      })()}

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
              className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
            >
              {msg.content.startsWith('[photo]') ? (
                <div className={`max-w-[75%] rounded-2xl overflow-hidden border shadow-sm
                  ${isMine ? 'rounded-tr-sm border-primary-200' : 'rounded-tl-sm border-gray-100'}`}
                >
                  <img loading="lazy"
                    src={msg.content.slice(7)}
                    alt="完工照片"
                    className="w-full max-w-[240px] object-cover cursor-pointer"
                    onClick={() => window.open(msg.content.slice(7), '_blank')}
                    onError={e => {
                      const el = e.target as HTMLImageElement
                      el.style.display = 'none'
                      el.parentElement?.insertAdjacentHTML('afterbegin',
                        '<div class="w-full max-w-[240px] h-24 flex items-center justify-center text-xs text-gray-400 bg-gray-100">图片加载失败</div>')
                    }}
                  />
                  <div className={`px-3 py-1.5 flex items-center justify-between gap-2 text-xs
                    ${isMine ? 'bg-primary-600 text-blue-200' : 'bg-white text-gray-400'}`}
                  >
                    <span>📎 完工照片</span>
                    <span>{new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ) : (
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                  ${isMine
                    ? msg.failed
                      ? 'bg-red-100 text-red-800 border border-red-200 rounded-tr-sm'
                      : 'bg-primary-600 text-white rounded-tr-sm'
                    : 'bg-white text-gray-800 border border-gray-100 shadow-sm rounded-tl-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-xs mt-1 ${isMine ? (msg.failed ? 'text-red-400' : 'text-blue-200') : 'text-gray-400'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}
              {isMine && !msg.failed && msg.id === lastMineId && (
                <span className="mt-0.5 text-[11px] text-gray-400">
                  {seenAt(otherLastRead, msg.created_at) ? '已读' : '已送达'}
                </span>
              )}
              {msg.failed && (
                <button
                  onClick={() => retryMessage(msg)}
                  className="mt-1 flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                >
                  <RotateCcw size={11} /> 发送失败，点击重试
                </button>
              )}
            </motion.div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input — locked once we learn the other party blocked us */}
      {blockedByOther ? (
        <div className="bg-gray-50 border-t border-gray-100 px-4 py-4 text-center">
          <p className="text-sm text-gray-500">🚫 对方已将你拉黑，无法继续发送消息</p>
        </div>
      ) : (
      <div className="bg-white border-t border-gray-100 px-3 py-3 flex items-end gap-2">
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoSelect}
        />
        <button
          onClick={() => photoInput.current?.click()}
          disabled={uploadingPhoto || sending}
          title="上传完工照片"
          className="w-9 h-9 flex-shrink-0 rounded-xl border border-gray-200 bg-gray-50
                     hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center
                     transition-colors active:scale-95"
        >
          {uploadingPhoto
            ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            : <ImagePlus size={16} className="text-gray-500" />
          }
        </button>
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
        <button onClick={() => sendMessage()} disabled={sending || !input.trim()}
          className="w-9 h-9 flex-shrink-0 rounded-xl bg-primary-600 hover:bg-primary-700
                     disabled:bg-gray-200 text-white flex items-center justify-center
                     transition-colors active:scale-95">
          <Send size={16} />
        </button>
      </div>
      )}
    </div>
    </div>

    {/* Report modal */}
    {reportOpen && (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-8 sm:pb-0">
        <motion.div
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl"
        >
          {reportSent ? (
            <div className="text-center py-4">
              <p className="text-2xl mb-2">✅</p>
              <p className="font-semibold text-gray-800">举报已提交</p>
              <p className="text-sm text-gray-500 mt-1">我们将在 24 小时内审核</p>
              <button onClick={() => { setReportOpen(false); setReportSent(false); setReportReason('') }}
                className="mt-4 w-full py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold">
                关闭
              </button>
            </div>
          ) : (
            <>
              <h3 className="font-semibold text-gray-900 mb-1">举报用户</h3>
              <p className="text-xs text-gray-400 mb-4">请描述问题，我们会认真处理每一条举报</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {['骚扰/辱骂', '虚假信息', '诈骗', '不当内容', '其他'].map(r => (
                  <button key={r} onClick={() => setReportReason(r)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      reportReason === r
                        ? 'bg-red-500 text-white border-red-500'
                        : 'border-gray-200 text-gray-600 hover:border-red-300'
                    }`}>
                    {r}
                  </button>
                ))}
              </div>
              <textarea
                value={reportReason}
                onChange={e => setReportReason(e.target.value)}
                placeholder="或输入详细说明…"
                rows={3}
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                           text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2
                           focus:ring-red-300 mb-4"
              />
              <div className="flex gap-2">
                <button onClick={() => { setReportOpen(false); setReportReason('') }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
                  取消
                </button>
                <button onClick={submitReport} disabled={!reportReason.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold
                             disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                  提交举报
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    )}

    {/* Block confirmation modal */}
    {blockOpen && (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-8 sm:pb-0">
        <motion.div
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl"
        >
          <h3 className="font-semibold text-gray-900 mb-1">拉黑这个用户？</h3>
          <p className="text-sm text-gray-500 mb-4">
            拉黑后，{conv?.other?.name ?? '对方'} 将无法再给你发消息。可以在"我的关注"里随时取消拉黑。
          </p>
          <div className="flex gap-2">
            <button onClick={() => setBlockOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
              取消
            </button>
            <button onClick={submitBlock} disabled={blockBusy}
              className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold
                         disabled:bg-gray-200 transition-colors">
              {blockBusy ? '处理中…' : '确认拉黑'}
            </button>
          </div>
        </motion.div>
      </div>
    )}

    {/* 标记成交 — 金额录入弹窗（金额选填，是 GMV/客单价的地基）*/}
    {dealOpen && (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-8 sm:pb-0">
        <motion.div
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl"
        >
          <h3 className="font-semibold text-gray-900 mb-1">标记成交</h3>
          <p className="text-sm text-gray-500 mb-4">
            发起后需 {conv?.other?.name ?? '对方'} 确认，双方确认即计入成交。填写成交金额有助于统计与展示（选填）。
          </p>
          <label className="block text-xs font-medium text-gray-500 mb-1">成交金额（选填）</label>
          <div className="flex items-center gap-2 mb-4 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary-300">
            <span className="text-gray-400 text-sm">$</span>
            <input
              type="number" inputMode="decimal" min="0" step="1"
              value={dealAmount} onChange={(e) => setDealAmount(e.target.value)}
              placeholder="如 222，可留空"
              className="flex-1 text-sm outline-none bg-transparent"
            />
            <span className="text-gray-400 text-xs">CAD</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setDealOpen(false); setDealAmount('') }}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
              取消
            </button>
            <button onClick={markDeal} disabled={marking}
              className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold
                         disabled:opacity-60 transition-colors">
              {marking ? '发起中…' : '发起成交'}
            </button>
          </div>
        </motion.div>
      </div>
    )}
    </>
  )
}
