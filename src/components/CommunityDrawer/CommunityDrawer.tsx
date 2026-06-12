// ─── Community Post Drawer ─────────────────────────────────────────────────
// Bottom sheet shown from PlazaPage — full post + comments without page nav.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Heart, MessageCircle, Send, Trash2, Flag, Share2, Check, Pencil, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { notifyAdminCommunityReport } from '../../lib/notify'
import { toast } from '../../lib/toast'
import { useAuthStore } from '../../store/authStore'
import { useReadStore } from '../../store/readStore'
import SaveButton from '../SaveButton/SaveButton'
import { POST_TYPE_CONFIG, AREA_CONFIG } from '../../pages/Community/config'

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

const REPORT_REASONS = [
  { key: 'irrelevant', label: '内容无关' },
  { key: 'malicious',  label: '恶意攻击' },
  { key: 'fake',       label: '虚假信息' },
  { key: 'spam',       label: '垃圾广告' },
  { key: 'other',      label: '其他' },
] as const

interface Props {
  postId: string
  onClose: () => void
}

export default function CommunityDrawer({ postId, onClose }: Props) {
  const navigate  = useNavigate()
  const user      = useAuthStore((s) => s.user)
  const markRead  = useReadStore((s) => s.markRead)
  const bottomRef = useRef<HTMLDivElement>(null)

  const [post,       setPost]       = useState<PostDetail | null>(null)
  const [comments,   setComments]   = useState<Comment[]>([])
  const [input,      setInput]      = useState('')
  const [sending,    setSending]    = useState(false)
  const [liked,      setLiked]      = useState(false)
  const [likeCount,  setLikeCount]  = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [copied,     setCopied]     = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportSubmitted, setReportSubmitted] = useState(false)
  const [reportSubmitting, setReportSubmitting] = useState(false)

  useEffect(() => {
    markRead('community', postId)
    setLoading(true)
    setPost(null)
    setComments([])
    setLiked(false)
    setShowReport(false)
    setReportSubmitted(false)

    supabase
      .from('community_posts')
      .select('id, title, content, images, type, area, like_count, created_at, author_id, author:author_id(id, name, avatar_url)')
      .eq('id', postId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setLoading(false); return }
        const p = { ...data, author: Array.isArray(data.author) ? data.author[0] : data.author }
        setPost(p as PostDetail)
        setLikeCount(p.like_count)
        setLoading(false)
      })

    supabase
      .from('community_comments')
      .select('id, content, created_at, author_id, author:author_id(id, name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!data) return
        setComments(data.map((c: any) => ({
          ...c,
          author: Array.isArray(c.author) ? c.author[0] : c.author,
        })))
      })
  }, [postId])

  useEffect(() => {
    if (!user) return
    supabase.from('community_likes')
      .select('post_id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setLiked(true) })
  }, [postId, user])

  // Realtime comments
  useEffect(() => {
    const channel = supabase
      .channel(`drawer-community-${postId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_comments', filter: `post_id=eq.${postId}` },
        async (payload) => {
          const c = payload.new as any
          const { data: authorData } = await supabase.from('public_profiles').select('id, name, avatar_url').eq('id', c.author_id).single()
          setComments(prev => prev.some(x => x.id === c.id) ? prev : [...prev, { ...c, author: authorData ?? null }])
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [postId])

  const prevSendingRef = useRef(false)
  useEffect(() => {
    if (prevSendingRef.current && !sending) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevSendingRef.current = sending
  }, [sending])

  async function sendComment() {
    const text = input.trim()
    if (!text || !user) return
    setSending(true)
    setInput('')
    const { error } = await supabase.from('community_comments').insert({ post_id: postId, author_id: user.id, content: text })
    if (error) { setInput(text); toast('评论发送失败，请稍后再试', 'error') }
    setSending(false)
  }

  async function deleteComment(commentId: string) {
    const prev = comments
    setComments(c => c.filter(x => x.id !== commentId))
    const { error } = await supabase.from('community_comments').delete().eq('id', commentId)
    if (error) { setComments(prev); toast('删除失败，请稍后再试', 'error') }
  }

  async function toggleLike() {
    if (!user) { navigate('/login'); return }
    const next = !liked
    setLiked(next)
    setLikeCount(c => c + (next ? 1 : -1))
    const { error } = next
      ? await supabase.from('community_likes').insert({ user_id: user.id, post_id: postId })
      : await supabase.from('community_likes').delete().eq('user_id', user.id).eq('post_id', postId)
    if (error) { setLiked(!next); setLikeCount(c => c + (next ? -1 : 1)) }
  }

  async function submitReport() {
    if (!user || !reportReason || !post) return
    setReportSubmitting(true)
    const { error } = await supabase.from('content_reports').insert({
      content_type: 'community_post', content_id: postId,
      content_title: post.title, reporter_id: user.id, reason: reportReason,
    })
    setReportSubmitting(false)
    if (error) { toast(error.code === '23505' ? '您已举报过这条帖子' : '举报失败', 'error'); return }
    setReportSubmitted(true)
    setShowReport(false)
    const reasonLabel = REPORT_REASONS.find(r => r.key === reportReason)?.label ?? reportReason
    void notifyAdminCommunityReport({
      reportType: 'post', reasonLabel, postId,
      postTitle: post.title,
      reporterName: user.user_metadata?.name || user.email || '社区用户',
    })
  }

  async function sharePost() {
    if (!post) return
    const url = `${window.location.origin}/community/${post.id}`
    if (navigator.share) {
      try { await navigator.share({ title: post.title, url }) } catch { /* cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(url) } catch { /* ignore */ }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const tc = post ? POST_TYPE_CONFIG[post.type] : null

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-[50]"
      />
      <motion.div
        key="drawer"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        className="fixed bottom-0 left-0 right-0 z-[51] bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-600">社区圈子</span>
          <div className="flex items-center gap-2">
            {post && (
              <>
                <SaveButton type="community" id={post.id} size={18} className="w-8 h-8" />
                <button
                  onClick={() => { onClose(); navigate(`/community/${postId}`) }}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                  title="在新页面打开"
                >
                  <ExternalLink size={16} />
                </button>
              </>
            )}
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">加载中…</div>
          ) : !post ? (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">帖子不存在</div>
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-4">
              {/* Post card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
                {/* Author */}
                <div className="flex items-center gap-3 mb-3">
                  {post.author?.avatar_url ? (
                    <img src={post.author.avatar_url} alt={post.author.name}
                      className="w-9 h-9 rounded-full object-cover border border-gray-100" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                                    flex items-center justify-center text-white font-bold text-sm">
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

                <h1 className="text-base font-bold text-gray-900 mb-2 leading-snug">{post.title}</h1>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>

                {post.images && post.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {post.images.map((url, i) => (
                      <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-xl" />
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-4 pt-3 border-t border-gray-50">
                  <button onClick={toggleLike}
                    className={`flex items-center gap-1.5 text-sm font-medium transition-colors
                                ${liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}>
                    <Heart size={15} className={liked ? 'fill-red-500' : ''} />
                    {likeCount > 0 && likeCount}
                    <span>{liked ? '已赞' : '点赞'}</span>
                  </button>
                  <span className="flex items-center gap-1.5 text-sm text-gray-400">
                    <MessageCircle size={15} />{comments.length}
                  </span>
                  <button onClick={sharePost}
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-primary-500 transition-colors">
                    {copied ? <Check size={15} className="text-green-500" /> : <Share2 size={15} />}
                    <span>{copied ? '已复制' : '分享'}</span>
                  </button>
                  {user?.id !== post.author_id && (
                    reportSubmitted ? (
                      <span className="ml-auto flex items-center gap-1 text-xs text-orange-500">
                        <Flag size={11} /> 已举报
                      </span>
                    ) : (
                      <button onClick={() => user ? setShowReport(v => !v) : navigate('/login')}
                        className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-orange-500 transition-colors">
                        <Flag size={11} /> 举报
                      </button>
                    )
                  )}
                </div>

                <AnimatePresence>
                  {showReport && !reportSubmitted && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
                        <p className="text-xs font-semibold text-orange-700">选择举报原因</p>
                        <div className="space-y-1">
                          {REPORT_REASONS.map(opt => (
                            <label key={opt.key} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                              <input type="radio" name="drawer-report" value={opt.key}
                                checked={reportReason === opt.key} onChange={() => setReportReason(opt.key)}
                                className="accent-orange-500" />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => { setShowReport(false); setReportReason('') }}
                            className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white transition-colors">
                            取消
                          </button>
                          <button onClick={submitReport} disabled={!reportReason || reportSubmitting}
                            className="flex-1 text-xs py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors">
                            {reportSubmitting ? '提交中…' : '提交举报'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Comments */}
              <p className="text-xs font-semibold text-gray-400 px-1 mb-2">全部回复 ({comments.length})</p>
              {comments.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center text-gray-400 text-sm mb-4">
                  还没有人回复，来说点什么吧
                </div>
              )}
              <AnimatePresence>
                {comments.map((c, i) => (
                  <motion.div key={c.id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex gap-3 mb-2"
                  >
                    {c.author?.avatar_url ? (
                      <img src={c.author.avatar_url} alt={c.author.name}
                        className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-gray-100" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
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
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={bottomRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Comment input */}
        <div className="border-t border-gray-100 px-4 py-3 flex items-end gap-2 flex-shrink-0 bg-white">
          {user ? (
            <>
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
                <Send size={15} />
              </button>
            </>
          ) : (
            <button onClick={() => navigate('/login')}
              className="flex-1 text-sm text-primary-600 font-semibold text-center py-2 hover:underline">
              登录后参与讨论 →
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
