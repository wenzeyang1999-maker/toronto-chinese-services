// ─── AI Chat Widget ────────────────────────────────────────────────────────────
// Floating chat bubble (bottom-right). Connects to the ai-chat Supabase Edge
// Function which proxies to Claude and streams SSE tokens back in real-time.
//
// Deploy backend first:
//   supabase functions deploy ai-chat
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, X, Send, ChevronDown } from 'lucide-react'
import type { ChatSession } from '../../pages/Profile/types'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const EDGE_FN_URL       = `${SUPABASE_URL}/functions/v1/ai-chat`

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean   // true while tokens are still arriving
}

function saveChatSession(messages: Message[]) {
  if (messages.length < 2) return
  try {
    const key = 'tcs_chat_history'
    const prev: ChatSession[] = JSON.parse(localStorage.getItem(key) ?? '[]')
    const first = messages.find(m => m.role === 'user')
    const session: ChatSession = {
      id: Date.now().toString(),
      preview: first?.content.slice(0, 40) ?? '对话',
      ts: Date.now(),
      count: messages.length,
    }
    localStorage.setItem(key, JSON.stringify([session, ...prev].slice(0, 20)))
  } catch { /* ignore */ }
}

// ── Quick-reply chips shown before the first user message ─────────────────────
const QUICK_REPLIES = [
  '我需要搬家服务',
  '找清洁阿姨',
  '机场接送怎么预约',
  '有现金工吗',
]

// ─────────────────────────────────────────────────────────────────────────────
export default function AiChatWidget() {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [busy, setBusy]         = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLTextAreaElement>(null)
  const abortRef                = useRef<AbortController | null>(null)

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when widget opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300)
  }, [open])

  // Save chat session when widget closes
  useEffect(() => {
    if (!open && messages.length >= 2) saveChatSession(messages)
  }, [open, messages])

  // ── Send a user message and stream the response ──────────────────────────
  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return

    setInput('')
    setBusy(true)

    const userMsg: Message  = { role: 'user', content: trimmed }
    const botMsg:  Message  = { role: 'assistant', content: '', streaming: true }

    setMessages(prev => [...prev, userMsg, botMsg])

    // Build history for the API (exclude the in-progress bot placeholder)
    const history: { role: 'user' | 'assistant'; content: string }[] = [
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: trimmed },
    ]

    abortRef.current = new AbortController()

    try {
      const res = await fetch(EDGE_FN_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body:   JSON.stringify({ messages: history }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error ?? '服务暂时不可用，请稍后再试')
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''   // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') break
          try {
            const { text } = JSON.parse(payload) as { text: string }
            setMessages(prev => {
              const copy = [...prev]
              const last = copy[copy.length - 1]
              if (last?.role === 'assistant') {
                copy[copy.length - 1] = { ...last, content: last.content + text }
              }
              return copy
            })
          } catch {
            // malformed SSE chunk — skip
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return
      const msg = err instanceof Error ? err.message : '网络错误，请重试'
      setMessages(prev => {
        const copy = [...prev]
        const last = copy[copy.length - 1]
        if (last?.role === 'assistant') {
          copy[copy.length - 1] = { ...last, content: msg }
        }
        return copy
      })
    } finally {
      // Mark streaming done
      setMessages(prev => {
        const copy = [...prev]
        const last = copy[copy.length - 1]
        if (last?.role === 'assistant') {
          copy[copy.length - 1] = { ...last, streaming: false }
        }
        return copy
      })
      setBusy(false)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Floating trigger button ── */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="trigger"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.93 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-24 right-5 lg:bottom-6 lg:right-16 z-50 flex items-center gap-2
                       bg-primary-600 hover:bg-primary-700
                       text-white rounded-full shadow-lg px-4 py-3
                       transition-colors"
            aria-label="打开 AI 客服"
          >
            <Bot size={20} />
            <span className="text-sm font-semibold whitespace-nowrap">AI 客服</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Chat window ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="fixed bottom-24 right-4 lg:bottom-5 lg:right-16 z-50
                       w-[min(92vw,380px)] h-[min(75vh,560px)]
                       flex flex-col rounded-2xl shadow-2xl overflow-hidden
                       bg-white border border-gray-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3
                            bg-primary-600 text-white flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">TCS 智能助手</p>
                  <p className="text-xs text-blue-200 leading-tight">在线 · 即时回复</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="关闭"
              >
                <ChevronDown size={20} />
              </button>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
              {/* Welcome message */}
              {messages.length === 0 && (
                <div className="space-y-3">
                  <BotBubble text="您好！我是 TCS 智能助手 👋 我可以帮您找到适合的服务，解答平台使用问题。请问有什么可以帮您？" />
                  {/* Quick reply chips */}
                  <div className="flex flex-wrap gap-2 pl-8">
                    {QUICK_REPLIES.map(q => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        disabled={busy}
                        className="text-xs bg-white border border-primary-200 text-primary-700
                                   rounded-full px-3 py-1.5 hover:bg-primary-50
                                   active:scale-95 transition-all disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) =>
                m.role === 'user'
                  ? <UserBubble key={i} text={m.content} />
                  : <BotBubble  key={i} text={m.content} streaming={m.streaming} />
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div className="flex items-end gap-2 px-3 py-3 border-t border-gray-100 bg-white flex-shrink-0">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="输入您的问题…"
                rows={1}
                disabled={busy}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5
                           text-sm text-gray-800 placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-primary-300
                           disabled:opacity-60 max-h-28"
                style={{ lineHeight: '1.45' }}
              />
              <button
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                className="flex-shrink-0 w-9 h-9 rounded-xl
                           bg-primary-600 hover:bg-primary-700
                           disabled:bg-gray-200 disabled:text-gray-400
                           text-white flex items-center justify-center
                           transition-colors active:scale-95"
                aria-label="发送"
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function BotBubble({ text, streaming }: { text: string; streaming?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot size={14} className="text-primary-600" />
      </div>
      <div className="bg-white rounded-2xl rounded-tl-sm px-3.5 py-2.5
                      text-sm text-gray-800 shadow-sm border border-gray-100
                      max-w-[85%] leading-relaxed whitespace-pre-wrap">
        {text || (streaming ? <TypingDots /> : null)}
        {streaming && text && <span className="inline-block w-1.5 h-3.5 bg-primary-500 ml-0.5 animate-pulse rounded-sm align-middle" />}
      </div>
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="bg-primary-600 text-white rounded-2xl rounded-tr-sm
                      px-3.5 py-2.5 text-sm max-w-[80%] leading-relaxed
                      whitespace-pre-wrap">
        {text}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 h-4">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  )
}
