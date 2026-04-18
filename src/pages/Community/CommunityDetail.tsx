// ─── Community Detail Page ────────────────────────────────────────────────────
// Route: /community/:id
// Full post view + comments
import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Heart, MessageCircle, Send, Trash2, Flag } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { notifyAdminCommunityReport } from '../../lib/notify'
import { useAuthStore } from '../../store/authStore'
import { POST_TYPE_CONFIG, AREA_CONFIG } from './config'

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

const REPORT_REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((item) => [item.key, item.label])) as Record<string, string>

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
  const [showReportForm, setShowReportForm] = useState(false)
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportReason, setReportReason] = useState<string>('')
  const [reportSubmitted, setReportSubmitted] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null)
  const [commentReportReason, setCommentReportReason] = useState<string>('')
  const [commentReportSubmitting, setCommentReportSubmitting] = useState(false)
  const [commentReportError, setCommentReportError] = useState<string | null>(null)
  const [reportedCommentIds, setReportedCommentIds] = useState<Set<string>>(new Set())

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

  useEffect(() => {
    if (!id || !user) return
    supabase.from('community_post_reports')
      .select('post_id')
      .eq('post_id', id)
      .eq('reporter_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setReportSubmitted(true) })
  }, [id, user])

  useEffect(() => {
    if (!user || comments.length === 0) return
    const ids = comments.map(c => c.id)
    supabase.from('community_comment_reports')
      .select('comment_id')
      .eq('reporter_id', user.id)
      .in('comment_id', ids)
      .then(({ data }) => {
        setReportedCommentIds(new Set((data ?? []).map((row: any) => row.comment_id)))
      })
  }, [comments, user])

  // Realtime comments
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`community-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_comments', filter: `post_id=eq.${id}` },
        async (payload) => {
          const c = payload.new as any
          const { data: authorData } = await supabase.from('public_profiles').select('id, name, avatar_url').eq('id', c.author_id).single()
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
    const { error } = await supabase
      .from('community_comments')
      .insert({ post_id: id, author_id: user.id, content: text })
    if (error) {
      setInput(text) // restore on failure
      alert('评论发送失败，请稍后再试')
    }
    setSending(false)
  }

  async function deleteComment(commentId: string) {
    const prev = comments
    setComments(c => c.filter(x => x.id !== commentId))
    const { error } = await supabase.from('community_comments').delete().eq('id', commentId)
    if (error) {
      setComments(prev) // rollback
      alert('删除失败，请稍后再试')
    }
  }

  async function deletePost() {
    if (!post || !user || user.id !== post.author_id) return
    if (!confirm('确定删除这条帖子？')) return
    const { error } = await supabase.from('community_posts').delete().eq('id', post.id)
    if (error) {
      alert('删除失败，请稍后再试')
      return
    }
    navigate('/community')
  }

  async function toggleLike() {
    if (!id || !user) return
    const next = !liked
    // Optimistic update
    setLiked(next)
    setLikeCount(c => c + (next ? 1 : -1))

    const { error } = next
      ? await supabase.from('community_likes').insert({ user_id: user.id, post_id: id })
      : await supabase.from('community_likes').delete().eq('user_id', user.id).eq('post_id', id)

    if (error) {
      // Rollback optimistic update
      setLiked(!next)
      setLikeCount(c => c + (next ? -1 : 1))
    }
  }

  async function submitReport() {
    if (!id || !user || !reportReason) return
    setReportError(null)
    setReportSubmitting(true)
    const { error } = await supabase.from('community_post_reports').insert({
      post_id: id,
      reporter_id: user.id,
      reason: reportReason,
    })
    setReportSubmitting(false)
    if (error) {
      setReportError(error.code === '23505' ? '您已经举报过这条帖子了' : '举报失败，请稍后再试')
      return
    }
    setReportSubmitted(true)
    setReportReason('')
    setShowReportForm(false)
    void notifyAdminsAboutReport({
      reportType: 'post',
      reason: reportReason,
      postId: id,
      postTitle: post?.title ?? '社区帖子',
    })
  }

  async function submitCommentReport(commentId: string) {
    if (!user || !commentReportReason) return
    setCommentReportError(null)
    setCommentReportSubmitting(true)
    const { error } = await supabase.from('community_comment_reports').insert({
      comment_id: commentId,
      reporter_id: user.id,
      reason: commentReportReason,
    })
    setCommentReportSubmitting(false)
    if (error) {
      setCommentReportError(error.code === '23505' ? '您已经举报过这条评论了' : '举报失败，请稍后再试')
      return
    }
    setReportedCommentIds(prev => new Set([...prev, commentId]))
    setReportingCommentId(null)
    setCommentReportReason('')
    const comment = comments.find((item) => item.id === commentId)
    void notifyAdminsAboutReport({
      reportType: 'comment',
      reason: commentReportReason,
      postId: id ?? '',
      postTitle: post?.title ?? '社区帖子',
      commentPreview: comment?.content ?? '',
    })
  }

  async function notifyAdminsAboutReport(opts: {
    reportType: 'post' | 'comment'
    reason: string
    postId: string
    postTitle: string
    commentPreview?: string
  }) {
    if (!user || !opts.postId) return

    const reasonLabel = REPORT_REASON_LABEL[opts.reason] ?? opts.reason
    await notifyAdminCommunityReport({
      reportType: opts.reportType,
      reasonLabel,
      postId: opts.postId,
      postTitle: opts.postTitle,
      commentPreview: opts.commentPreview?.slice(0, 120),
      reporterName: user.user_metadata?.name || user.email || '社区用户',
    })
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
              {user?.id !== post.author_id && (
                reportSubmitted ? (
                  <span className="ml-auto flex items-center gap-1 text-xs text-orange-500">
                    <Flag size={12} /> 已举报
                  </span>
                ) : (
                  <button
                    onClick={() => user ? setShowReportForm(v => !v) : navigate('/login')}
                    className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-orange-500 transition-colors"
                  >
                    <Flag size={12} /> 举报
                  </button>
                )
              )}
            </div>
            <AnimatePresence>
              {showReportForm && !reportSubmitted && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-orange-700">选择举报原因</p>
                    <div className="space-y-1">
                      {REPORT_REASONS.map(opt => (
                        <label key={opt.key} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input
                            type="radio"
                            name="community-report"
                            value={opt.key}
                            checked={reportReason === opt.key}
                            onChange={() => setReportReason(opt.key)}
                            className="accent-orange-500"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                    {reportError && <p className="text-xs text-red-500">{reportError}</p>}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => { setShowReportForm(false); setReportReason(''); setReportError(null) }}
                        className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={submitReport}
                        disabled={!reportReason || reportSubmitting}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
                      >
                        {reportSubmitting ? '提交中…' : '提交举报'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
                      {user?.id !== c.author_id && (
                        reportedCommentIds.has(c.id) ? (
                          <span className="text-[11px] text-orange-500 flex items-center gap-0.5">
                            <Flag size={10} /> 已举报
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              if (!user) { navigate('/login'); return }
                              setReportingCommentId(prev => prev === c.id ? null : c.id)
                              setCommentReportReason('')
                              setCommentReportError(null)
                            }}
                            className="text-[11px] text-gray-300 hover:text-orange-400 transition-colors"
                          >
                            <Flag size={11} />
                          </button>
                        )
                      )}
                      {user?.id === c.author_id && (
                        <button onClick={() => deleteComment(c.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                    <AnimatePresence>
                      {reportingCommentId === c.id && !reportedCommentIds.has(c.id) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
                            <p className="text-xs font-semibold text-orange-700">选择举报原因</p>
                            <div className="space-y-1">
                              {REPORT_REASONS.map(opt => (
                                <label key={`${c.id}-${opt.key}`} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`community-comment-report-${c.id}`}
                                    value={opt.key}
                                    checked={commentReportReason === opt.key}
                                    onChange={() => setCommentReportReason(opt.key)}
                                    className="accent-orange-500"
                                  />
                                  {opt.label}
                                </label>
                              ))}
                            </div>
                            {commentReportError && <p className="text-xs text-red-500">{commentReportError}</p>}
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => { setReportingCommentId(null); setCommentReportReason(''); setCommentReportError(null) }}
                                className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white transition-colors"
                              >
                                取消
                              </button>
                              <button
                                onClick={() => submitCommentReport(c.id)}
                                disabled={!commentReportReason || commentReportSubmitting}
                                className="flex-1 text-xs py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
                              >
                                {commentReportSubmitting ? '提交中…' : '提交举报'}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
