import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Send, Trash2, User } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'

interface Comment {
  id: string
  author_id: string
  content: string
  created_at: string
  author: { name: string; avatar_url: string | null } | null
}

interface Props {
  itemId: string
  sellerId: string
}

export default function SecondhandComments({ itemId, sellerId }: Props) {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const [comments,   setComments]   = useState<Comment[]>([])
  const [ready,      setReady]      = useState(false)
  const [input,      setInput]      = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!itemId) return
    setReady(false)
    supabase
      .from('secondhand_comments')
      .select('id, author_id, content, created_at, author:users(name, avatar_url)')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setComments(
            data.map((c: any) => ({
              ...c,
              author: Array.isArray(c.author) ? c.author[0] : c.author,
            }))
          )
        }
        setReady(true)
      })
  }, [itemId])

  async function submit() {
    if (!user) { navigate('/login'); return }
    const text = input.trim()
    if (!text) return
    setSubmitting(true)
    const { data, error } = await supabase
      .from('secondhand_comments')
      .insert({ item_id: itemId, author_id: user.id, content: text })
      .select('id, author_id, content, created_at')
      .single()
    if (!error && data) {
      const fresh: Comment = {
        ...data,
        author: {
          name: user.user_metadata?.name ?? '我',
          avatar_url: user.user_metadata?.avatar_url ?? null,
        },
      }
      setComments(prev => [fresh, ...prev])
      setInput('')
    }
    setSubmitting(false)
  }

  async function remove(id: string) {
    if (!confirm('删除这条留言？')) return
    const { error } = await supabase.from('secondhand_comments').delete().eq('id', id)
    if (!error) setComments(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={16} className="text-primary-500" />
        <h2 className="text-sm font-semibold text-gray-700">
          留言区 {comments.length > 0 && `(${comments.length})`}
        </h2>
      </div>

      {/* Composer */}
      {user ? (
        <div className="flex gap-2 mb-4">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if ((e.key === 'Enter') && (e.metaKey || e.ctrlKey)) submit()
            }}
            placeholder="问问卖家或留言…（⌘/Ctrl + Enter 发送）"
            rows={2}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none resize-none
                       focus:ring-2 focus:ring-primary-100 focus:border-primary-300"
          />
          <button
            onClick={submit}
            disabled={!input.trim() || submitting}
            className="flex items-center gap-1.5 self-stretch bg-primary-600 hover:bg-primary-700
                       text-white text-xs font-semibold px-3 rounded-xl
                       disabled:opacity-40 disabled:hover:bg-primary-600 transition-colors"
          >
            <Send size={14} />
            发送
          </button>
        </div>
      ) : (
        <button
          onClick={() => navigate('/login')}
          className="w-full mb-4 text-sm text-primary-600 font-medium border border-primary-100 bg-primary-50 rounded-xl py-2.5 hover:bg-primary-100 transition-colors"
        >
          登录后发表留言
        </button>
      )}

      {/* List */}
      {!ready ? (
        <p className="text-xs text-gray-400 text-center py-4">加载中…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">还没有留言，来抢沙发</p>
      ) : (
        <div className="divide-y divide-gray-50">
          <AnimatePresence>
            {comments.map((c) => {
              const isSeller = c.author_id === sellerId
              const isMine   = !!user && c.author_id === user.id
              return (
                <motion.div key={c.id}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex gap-3 py-3"
                >
                  <button
                    onClick={() => navigate(`/provider/${c.author_id}`)}
                    className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 overflow-hidden"
                  >
                    {c.author?.avatar_url
                      ? <img src={c.author.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <User size={14} className="text-primary-500" />
                    }
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => navigate(`/provider/${c.author_id}`)}
                        className="text-sm font-medium text-gray-800 hover:text-primary-600 transition-colors"
                      >
                        {c.author?.name ?? '用户'}
                      </button>
                      {isSeller && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-600 font-bold">
                          卖家
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">
                        {new Date(c.created_at).toLocaleDateString('zh-CN')}
                      </span>
                      {isMine && (
                        <button
                          onClick={() => remove(c.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          aria-label="删除留言"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
