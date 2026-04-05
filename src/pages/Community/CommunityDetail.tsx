// ─── Community Detail Page ────────────────────────────────────────────────────
// Route: /community/:id
// Full post view + comments
import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Heart, MessageCircle, Send, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { POST_TYPE_CONFIG, AREA_CONFIG } from './CommunityPage'

interface PostDetail {
  id: string
  title: string
  content: string
  images: string[]
  type: string
  area: string
  like_count: number
  created_at: string
  author_id: string
  author: { id: string; name: string; avatar_url: string | null } | null
}

interface Comment {
  id: string
  content: string
  created_at: string
  author_id: string
  author: { id: string; name: string; avatar_url: string | null } | null
}

export default function CommunityDetail() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const user      = useAuthStore((s) => s.user)
  const bottomRef = useRef<HTMLDivElement>(null)

  const [post,     setPost]     = useState<PostDetail | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [input,    setInput]    = useState('')
  const [sending,  setSending]  = useState(false)
  const [liked,    setLiked]    = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!id) return
    supabase
      .from('community_posts')
      .select('id, title, content, images, type, area, like_count, created_at, author_id, author:author_id(id, name, avatar_url)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setLoading(false); return }
        const p = { ...data, author: Array.isArray(data.author) ? data.author[0] : data.author }
        setPost(p)
        setLikeCount(p.like_count)
        setLoading(false)
      })

    supabase
      .from('community_comments')
      .select('id, content, created_at, author_id, author:author_id(id, name, avatar_url)')
      .eq('post_id', id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!data) return
        setComments(data.map((c: any) => ({
          ...c,
          author: Array.isArray(c.author) ? c.author[0] : c.author,
        })))
      })
  }, [id])

  // Check if current user already liked this post
  useEffect(() => {
    if (!id || !user) return
    supabase.from('community_likes')
      .select('post_id')
      .eq('post_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setLiked(true) })
  }, [id, user])

  // Realtime comments
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`community-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_comments', filter: `post_id=eq.${id}` },
        async (payload) => {
          const c = payload.new as any
          const { data: authorData } = await supabase.from('users').select('id, name, avatar_url').eq('id', c.author_id).single()
          setComments(prev => prev.some(x => x.id === c.id) ? prev : [...prev, { ...c, author: authorData ?? null }])
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  async function sendComment() {
    const text = input.trim()
    if (!text || !id || !user) return
    setSending(true)
    setInput('')
    await supabase.from('community_comments').insert({ post_id: id, author_id: user.id, content: text })
    setSending(false)
  }

  async function deleteComment(commentId: string) {
    setComments(prev => prev.filter(c => c.id !== commentId))
    await supabase.from('community_comments').delete().eq('id', commentId)
  }

  async function deletePost() {
    if (!post || !user || user.id !== post.author_id) return
    if (!confirm('确定删除这条帖子？')) return
    await supabase.from('community_posts').delete().eq('id', post.id)
    navigate('/community')
  }

  async function toggleLike() {
    if (!id || !user) return
    const next = !liked
    setLiked(next)
    setLikeCount(c => c + (next ? 1 : -1))

    if (next) {
      await supabase.from('community_likes').insert({ user_id: user.id, post_id: id })
      await supabase.from('community_posts').update({ like_count: likeCount + 1 }).eq('id', id)
    } else {
      await supabase.from('community_likes').delete().eq('user_id', user.id).eq('post_id', id)
      await supabase.from('community_posts').update({ like_count: Math.max(0, likeCount - 1) }).eq('id', id)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">加载中…</div>
  )
  if (!post) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-gray-500">
      <p>帖子不存在</p>
      <button onClick={() => navigate('/community')} className="text-primary-600 text-sm">返回社区</button>
    </div>
  )

  const tc = POST_TYPE_CONFIG[post.type]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
          <ArrowLeft size={22} />
        </button>
        <span className="flex-1 text-sm font-semibold text-gray-800 truncate">社区圈子</span>
        {user?.id === post.author_id && (
          <button onClick={deletePost} className="text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-5">

          {/* Post card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">

            {/* Author + meta */}
            <div className="flex items-center gap-3 mb-4">
              {post.author?.avatar_url ? (
                <img src={post.author.avatar_url} alt={post.author.name}
                  className="w-10 h-10 rounded-full object-cover border border-gray-100" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                                flex items-center justify-center text-white font-bold">
                  {post.author?.name?.charAt(0) ?? '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{post.author?.name ?? '匿名'}</p>
                <p className="text-xs text-gray-400">{post.created_at.slice(0, 10)} · 📍 {AREA_CONFIG[post.area] ?? post.area}</p>
              </div>
              <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${tc?.color}`}>
                {tc?.emoji} {tc?.label}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-lg font-bold text-gray-900 mb-3 leading-snug">{post.title}</h1>

            {/* Content */}
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-4">{post.content}</p>

            {/* Images */}
            {post.images && post.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {post.images.map((url, i) => (
                  <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-xl" />
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-4 pt-3 border-t border-gray-50">
              <button onClick={() => user ? toggleLike() : navigate('/login')}
                className={`flex items-center gap-1.5 text-sm font-medium transition-colors
                            ${liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}>
                <Heart size={16} className={liked ? 'fill-red-500' : ''} />
                {likeCount > 0 && likeCount}
                <span>{liked ? '已赞' : '点赞'}</span>
              </button>
              <span className="flex items-center gap-1.5 text-sm text-gray-400">
                <MessageCircle size={16} />
                {comments.length} 条回复
              </span>
            </div>
          </div>

          {/* Comments */}
          <div className="space-y-3 mb-4">
            <p className="text-xs font-semibold text-gray-400 px-1">全部回复 ({comments.length})</p>
            {comments.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-gray-400 text-sm">
                还没有人回复，来说点什么吧
              </div>
            )}
            <AnimatePresence>
              {comments.map((c, i) => (
                <motion.div key={c.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex gap-3"
                >
                  {c.author?.avatar_url ? (
                    <img src={c.author.avatar_url} alt={c.author.name}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-100" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                                    flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {c.author?.name?.charAt(0) ?? '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-700">{c.author?.name ?? '匿名'}</span>
                      <span className="text-xs text-gray-400 ml-auto">{c.created_at.slice(0, 10)}</span>
                      {user?.id === c.author_id && (
                        <button onClick={() => deleteComment(c.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      {/* Comment input */}
      {user ? (
        <div className="bg-white border-t border-gray-100 px-4 py-3 flex items-end gap-2 max-w-2xl mx-auto w-full">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }}
            placeholder="说点什么…"
            rows={1}
            disabled={sending}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5
                       text-sm text-gray-800 placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-primary-300
                       disabled:opacity-60 max-h-28"
          />
          <button onClick={sendComment} disabled={sending || !input.trim()}
            className="w-9 h-9 flex-shrink-0 rounded-xl bg-primary-600 hover:bg-primary-700
                       disabled:bg-gray-200 text-white flex items-center justify-center
                       transition-colors active:scale-95">
            <Send size={16} />
          </button>
        </div>
      ) : (
        <div className="bg-white border-t border-gray-100 px-4 py-3 text-center">
          <button onClick={() => navigate('/login')}
            className="text-sm text-primary-600 font-semibold hover:underline">
            登录后参与讨论 →
          </button>
        </div>
      )}
    </div>
  )
}
