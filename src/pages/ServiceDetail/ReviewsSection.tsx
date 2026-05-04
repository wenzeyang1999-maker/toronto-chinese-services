// ─── Reviews Section ────────────────────────────────────────────────────────
// Features:
//   • Submit / edit reviews with star rating
//   • 👍/👎 helpful votes — affects sort order, never hides reviews
//   • 🚩 Report — sends to admin review queue
//   • 💬 Provider reply — service owner can reply once per review
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Send, Pencil, X, Check, ThumbsUp, ThumbsDown, Flag, MessageCircle, CornerDownRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { notifyNewReview } from '../../lib/notify'
import { toast } from '../../lib/toast'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Review {
  id:              string
  rating:          number
  comment:         string | null
  created_at:      string
  reviewer:        { id: string; name: string; avatar_url: string | null }
  helpful_count:   number
  unhelpful_count: number
  my_vote:         boolean | null   // true = 👍, false = 👎, null = no vote
  score:           number           // helpful - unhelpful (sort key)
}

interface Reply {
  id:         string
  content:    string
  created_at: string
  updated_at: string
}

const REPORT_REASONS: { key: string; label: string }[] = [
  { key: 'malicious',  label: '恶意差评 / 竞争对手' },
  { key: 'fake',       label: '虚假评价 / 未使用过服务' },
  { key: 'irrelevant', label: '内容无关 / 跑题' },
  { key: 'spam',       label: '垃圾广告' },
  { key: 'other',      label: '其他原因' },
]

interface Props { serviceId: string; providerId: string }

// ── Main component ────────────────────────────────────────────────────────────

export default function ReviewsSection({ serviceId, providerId }: Props) {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const [reviews,     setReviews]     = useState<Review[]>([])
  const [loading,     setLoading]     = useState(true)

  // New review form
  const [myRating,    setMyRating]    = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment,     setComment]     = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Edit mode
  const [editingId,      setEditingId]      = useState<string | null>(null)
  const [editRating,     setEditRating]     = useState(0)
  const [editHover,      setEditHover]      = useState(0)
  const [editComment,    setEditComment]    = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError,      setEditError]      = useState<string | null>(null)

  // Vote state (loading per-review)
  const [votingId, setVotingId] = useState<string | null>(null)

  // Report state
  const [reportingId,     setReportingId]     = useState<string | null>(null)
  const [reportReason,    setReportReason]     = useState<string>('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportedIds,     setReportedIds]     = useState<Set<string>>(new Set())

  // Reply state (provider replies)
  const [replies,          setReplies]         = useState<Record<string, Reply>>({})
  const [replyingId,       setReplyingId]      = useState<string | null>(null)
  const [replyText,        setReplyText]       = useState('')
  const [replySubmitting,  setReplySubmitting] = useState(false)
  const [replyError,       setReplyError]      = useState<string | null>(null)
  const [editingReplyId,   setEditingReplyId]  = useState<string | null>(null)
  const [editReplyText,    setEditReplyText]   = useState('')
  const [editReplySubmitting, setEditReplySubmitting] = useState(false)
  const [editReplyError,   setEditReplyError]  = useState<string | null>(null)
  const [reportError,      setReportError]     = useState<string | null>(null)

  const isOwnService    = user?.id === providerId
  const myReview        = reviews.find(r => r.reviewer?.id === user?.id)
  const alreadyReviewed = !!myReview

  // ── Load reviews + votes ───────────────────────────────────────────────────

  async function load() {
    const { data: reviewData, error } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at, reviewer:reviewer_id(id, name, avatar_url)')
      .eq('service_id', serviceId)

    if (error || !reviewData) { setLoading(false); return }

    const ids = reviewData.map(r => r.id)

    // Fetch all votes for these reviews in one query
    const { data: voteData } = ids.length > 0
      ? await supabase.from('review_votes').select('review_id, user_id, is_helpful').in('review_id', ids)
      : { data: [] }

    // Fetch which reviews the current user already reported
    const { data: reportData } = user && ids.length > 0
      ? await supabase.from('review_reports').select('review_id').eq('reporter_id', user.id).in('review_id', ids)
      : { data: [] }

    const votes   = voteData   ?? []
    const reports = reportData ?? []

    setReportedIds(new Set(reports.map((r: any) => r.review_id)))

    // Fetch provider replies for these reviews
    const { data: replyData } = ids.length > 0
      ? await supabase.from('review_replies').select('id, review_id, content, created_at, updated_at')
          .in('review_id', ids).eq('replier_id', providerId)
      : { data: [] }

    const replyMap: Record<string, Reply> = {}
    ;(replyData ?? []).forEach((rep: any) => {
      replyMap[rep.review_id] = { id: rep.id, content: rep.content, created_at: rep.created_at, updated_at: rep.updated_at }
    })
    setReplies(replyMap)

    const mapped: Review[] = reviewData.map((r: any) => {
      const rvotes      = votes.filter((v: any) => v.review_id === r.id)
      const helpful     = rvotes.filter((v: any) =>  v.is_helpful).length
      const unhelpful   = rvotes.filter((v: any) => !v.is_helpful).length
      const myVoteRow   = user ? rvotes.find((v: any) => v.user_id === user.id) : undefined
      const my_vote     = myVoteRow ? myVoteRow.is_helpful : null

      return {
        id:              r.id,
        rating:          r.rating,
        comment:         r.comment,
        created_at:      r.created_at,
        reviewer:        Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer,
        helpful_count:   helpful,
        unhelpful_count: unhelpful,
        my_vote,
        score:           helpful - unhelpful,
      }
    })

    // Sort: highest score first, then newest first
    mapped.sort((a, b) => b.score - a.score || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    setReviews(mapped)
    setLoading(false)
  }

  useEffect(() => { load() }, [serviceId, user?.id])

  // ── Submit new review ──────────────────────────────────────────────────────

  async function submit() {
    if (!user) { navigate('/login'); return }
    if (myRating === 0) { setSubmitError('请选择星级'); return }
    setSubmitting(true); setSubmitError(null)
    const { error } = await supabase.from('reviews').insert({
      service_id: serviceId, reviewer_id: user.id,
      rating: myRating, comment: comment.trim() || null,
    })
    setSubmitting(false)
    if (error) {
      setSubmitError(error.code === '23505' ? '您已经评价过这个服务了' : '提交失败，请稍后再试')
    } else {
      setMyRating(0); setComment(''); load()
      // Notify provider — fire and forget
      const reviewerName = user.user_metadata?.name ?? user.email ?? '用户'
      Promise.all([
        supabase.from('services').select('title').eq('id', serviceId).single(),
      ]).then(([svcRes]) => {
        notifyNewReview({
          recipientUserId: providerId,
          reviewerName,
          serviceTitle:   svcRes.data?.title ?? '您的服务',
          serviceId,
          rating:         String(myRating),
          comment:        comment.trim(),
        })
      })
    }
  }

  // ── Edit review ────────────────────────────────────────────────────────────

  function startEdit(r: Review) {
    setEditingId(r.id); setEditRating(r.rating)
    setEditComment(r.comment ?? ''); setEditError(null)
  }
  function cancelEdit() {
    setEditingId(null); setEditRating(0); setEditComment(''); setEditError(null)
  }
  async function saveEdit() {
    if (!user || !editingId) return
    if (editRating === 0) { setEditError('请选择星级'); return }
    setEditSubmitting(true); setEditError(null)
    const { error } = await supabase.from('reviews')
      .update({ rating: editRating, comment: editComment.trim() || null })
      .eq('id', editingId).eq('reviewer_id', user.id)
    setEditSubmitting(false)
    if (error) { setEditError('保存失败，请稍后再试') }
    else { cancelEdit(); load() }
  }

  // ── Helpful vote ───────────────────────────────────────────────────────────

  async function handleVote(reviewId: string, isHelpful: boolean) {
    if (!user) { navigate('/login'); return }
    setVotingId(reviewId)

    const current = reviews.find(r => r.id === reviewId)?.my_vote

    if (current === isHelpful) {
      // Same button clicked → toggle off (remove vote)
      await supabase.from('review_votes')
        .delete()
        .eq('review_id', reviewId)
        .eq('user_id', user.id)
    } else {
      // New vote or switch vote → upsert
      await supabase.from('review_votes')
        .upsert(
          { review_id: reviewId, user_id: user.id, is_helpful: isHelpful },
          { onConflict: 'review_id,user_id' }
        )
    }

    setVotingId(null)
    load()
  }

  // ── Report ─────────────────────────────────────────────────────────────────

  function openReport(reviewId: string) {
    if (!user) { navigate('/login'); return }
    setReportingId(reviewId)
    setReportReason('')
  }

  async function submitReport() {
    if (!user || !reportingId || !reportReason) return
    setReportSubmitting(true)
    setReportError(null)
    const { error } = await supabase.from('review_reports').insert({
      review_id:   reportingId,
      reporter_id: user.id,
      reason:      reportReason,
    })
    setReportSubmitting(false)
    if (error) {
      setReportError(error.code === '23505' ? '您已经举报过这条评价了' : '举报失败，请稍后再试')
      return
    }
    setReportedIds(prev => new Set([...prev, reportingId]))
    setReportingId(null)
    setReportReason('')
    setReportError(null)
  }

  // ── Provider reply ─────────────────────────────────────────────────────────

  function openReply(reviewId: string, existing?: Reply) {
    if (existing) {
      setEditingReplyId(reviewId)
      setEditReplyText(existing.content)
    } else {
      setReplyingId(reviewId)
      setReplyText('')
      setReplyError(null)
    }
  }

  async function submitReply(reviewId: string) {
    if (!user || !replyText.trim()) return
    setReplySubmitting(true); setReplyError(null)
    const { error } = await supabase.from('review_replies').insert({
      review_id: reviewId, replier_id: user.id, content: replyText.trim(),
    })
    setReplySubmitting(false)
    if (error) { setReplyError('回复失败，请稍后再试') }
    else { setReplyingId(null); setReplyText(''); load() }
  }

  async function saveReply(reviewId: string) {
    if (!user || !editReplyText.trim()) return
    setEditReplySubmitting(true)
    setEditReplyError(null)
    const reply = replies[reviewId]
    if (!reply) return
    const { error } = await supabase.from('review_replies')
      .update({ content: editReplyText.trim() })
      .eq('id', reply.id).eq('replier_id', user.id)
    setEditReplySubmitting(false)
    if (error) { setEditReplyError('保存失败，请稍后再试'); return }
    setEditingReplyId(null); setEditReplyText(''); load()
  }

  async function deleteReply(reviewId: string) {
    if (!user) return
    const reply = replies[reviewId]
    if (!reply) return
    const { error } = await supabase.from('review_replies').delete().eq('id', reply.id).eq('replier_id', user.id)
    if (error) { toast('删除回复失败，请稍后再试', 'error'); return }
    load()
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }} className="card p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">用户评价</h3>
        {reviews.length > 0 && (
          <div className="flex items-center gap-1.5">
            <StarRow rating={avgRating} size={14} />
            <span className="text-sm font-bold text-gray-800">{avgRating.toFixed(1)}</span>
            <span className="text-xs text-gray-400">（{reviews.length} 条）</span>
          </div>
        )}
      </div>

      {/* New review form */}
      {!isOwnService && !alreadyReviewed && (
        <div className="bg-gray-50 rounded-2xl p-4 mb-4">
          <p className="text-xs font-medium text-gray-600 mb-3">
            {user ? '写下您的评价' : '登录后可以留下评价'}
          </p>
          <StarPicker rating={myRating} hover={hoverRating}
            onPick={setMyRating} onHover={setHoverRating} />
          <textarea value={comment} onChange={e => setComment(e.target.value)}
            placeholder="分享您的使用体验（选填）" rows={3} disabled={!user}
            className="w-full mt-3 border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none
                       focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white
                       disabled:opacity-50 disabled:cursor-not-allowed" />
          {submitError && <p className="text-xs text-red-500 mt-1">{submitError}</p>}
          <button onClick={user ? submit : () => navigate('/login')} disabled={submitting}
            className="mt-2 flex items-center gap-2 bg-primary-600 text-white text-sm font-medium
                       px-5 py-2 rounded-xl hover:bg-primary-700 disabled:opacity-60 transition-colors">
            <Send size={14} />
            {submitting ? '提交中…' : user ? '提交评价' : '登录后评价'}
          </button>
        </div>
      )}

      {/* Review list */}
      {loading ? (
        <p className="text-xs text-gray-400 text-center py-4">加载中…</p>
      ) : reviews.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">暂无评价，快来留下第一条吧</p>
      ) : (
        <div className="space-y-5">
          <AnimatePresence>
            {reviews.map((r, i) => {
              const isOwnReview   = user?.id === r.reviewer?.id
              const canVote       = !!user && !isOwnReview && !isOwnService
              const alreadyReport = reportedIds.has(r.id)
              const isVoting      = votingId === r.id

              return (
                <motion.div key={r.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex gap-3"
                >
                  {/* Avatar */}
                  {r.reviewer?.avatar_url ? (
                    <img src={r.reviewer.avatar_url} alt={r.reviewer.name}
                      className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-gray-100" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                                    flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {r.reviewer?.name?.charAt(0) ?? '?'}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {editingId === r.id ? (
                      /* ── Edit form ── */
                      <div className="bg-gray-50 rounded-2xl p-3">
                        <StarPicker rating={editRating} hover={editHover}
                          onPick={setEditRating} onHover={setEditHover} />
                        <textarea value={editComment} onChange={e => setEditComment(e.target.value)}
                          rows={3}
                          className="w-full mt-2 border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none
                                     focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white" />
                        {editError && <p className="text-xs text-red-500 mt-1">{editError}</p>}
                        <div className="flex gap-2 mt-2">
                          <button onClick={cancelEdit}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">
                            <X size={12} /> 取消
                          </button>
                          <button onClick={saveEdit} disabled={editSubmitting}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 transition-colors">
                            <Check size={12} /> {editSubmitting ? '保存中…' : '保存'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Normal view ── */
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-800">
                            {r.reviewer?.name ?? '匿名用户'}
                          </span>
                          <StarRow rating={r.rating} size={12} />
                          <span className="text-xs text-gray-400 ml-auto">{r.created_at.slice(0, 10)}</span>
                          {isOwnReview && (
                            <button onClick={() => startEdit(r)}
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 transition-colors">
                              <Pencil size={11} /> 编辑
                            </button>
                          )}
                        </div>

                        {r.comment && (
                          <p className="text-sm text-gray-600 mt-1 leading-relaxed">{r.comment}</p>
                        )}

                        {/* ── Vote + Report bar ── */}
                        <div className="flex items-center gap-3 mt-2.5">
                          <span className="text-[11px] text-gray-400">这条评价有帮助吗？</span>

                          {/* 👍 */}
                          <button
                            disabled={!canVote || isVoting}
                            onClick={() => handleVote(r.id, true)}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all
                              disabled:cursor-not-allowed
                              ${r.my_vote === true
                                ? 'bg-green-50 border-green-300 text-green-600 font-semibold'
                                : 'border-gray-200 text-gray-400 hover:border-green-300 hover:text-green-600 disabled:hover:border-gray-200 disabled:hover:text-gray-400'
                              }`}
                          >
                            <ThumbsUp size={11} className={isVoting ? 'animate-pulse' : ''} />
                            <span>{r.helpful_count > 0 ? r.helpful_count : ''}</span>
                          </button>

                          {/* 👎 */}
                          <button
                            disabled={!canVote || isVoting}
                            onClick={() => handleVote(r.id, false)}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all
                              disabled:cursor-not-allowed
                              ${r.my_vote === false
                                ? 'bg-red-50 border-red-300 text-red-500 font-semibold'
                                : 'border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 disabled:hover:border-gray-200 disabled:hover:text-gray-400'
                              }`}
                          >
                            <ThumbsDown size={11} className={isVoting ? 'animate-pulse' : ''} />
                            <span>{r.unhelpful_count > 0 ? r.unhelpful_count : ''}</span>
                          </button>

                          {/* 🚩 Report */}
                          {!isOwnReview && !isOwnService && (
                            alreadyReport ? (
                              <span className="text-[11px] text-gray-400 flex items-center gap-0.5 ml-auto">
                                <Flag size={10} className="text-orange-400" /> 已举报
                              </span>
                            ) : (
                              <button
                                onClick={() => openReport(r.id)}
                                className="ml-auto flex items-center gap-1 text-[11px] text-gray-300
                                           hover:text-orange-400 transition-colors"
                              >
                                <Flag size={11} /> 举报
                              </button>
                            )
                          )}
                        </div>

                        {/* ── Report inline form ── */}
                        <AnimatePresence>
                          {reportingId === r.id && (
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
                                    <label key={opt.key}
                                      className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                      <input type="radio" name={`report-${r.id}`}
                                        value={opt.key}
                                        checked={reportReason === opt.key}
                                        onChange={() => setReportReason(opt.key)}
                                        className="accent-orange-500"
                                      />
                                      {opt.label}
                                    </label>
                                  ))}
                                </div>
                                {reportError && (
                                  <p className="text-xs text-red-500">{reportError}</p>
                                )}
                                <div className="flex gap-2 pt-1">
                                  <button onClick={() => { setReportingId(null); setReportReason(''); setReportError(null) }}
                                    className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white transition-colors">
                                    取消
                                  </button>
                                  <button
                                    disabled={!reportReason || reportSubmitting}
                                    onClick={submitReport}
                                    className="flex-1 text-xs py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600
                                               disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                    {reportSubmitting ? '提交中…' : '提交举报'}
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* ── Provider reply ── */}
                        {(() => {
                          const reply = replies[r.id]
                          // Show existing reply
                          if (reply && editingReplyId !== r.id) return (
                            <div className="mt-3 flex gap-2">
                              <CornerDownRight size={14} className="text-primary-300 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 bg-primary-50 border border-primary-100 rounded-xl px-3 py-2">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold text-primary-700">商家回复</span>
                                  <span className="text-[10px] text-gray-400">{reply.updated_at.slice(0,10)}</span>
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed">{reply.content}</p>
                                {isOwnService && (
                                  <div className="flex gap-2 mt-1.5">
                                    <button onClick={() => openReply(r.id, reply)}
                                      className="text-[11px] text-primary-500 hover:text-primary-700 transition-colors flex items-center gap-0.5">
                                      <Pencil size={10} /> 编辑
                                    </button>
                                    <button onClick={() => deleteReply(r.id)}
                                      className="text-[11px] text-gray-400 hover:text-red-400 transition-colors flex items-center gap-0.5">
                                      <X size={10} /> 删除
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                          // Edit reply form
                          if (reply && editingReplyId === r.id) return (
                            <div className="mt-3 flex gap-2">
                              <CornerDownRight size={14} className="text-primary-300 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <textarea value={editReplyText} onChange={e => setEditReplyText(e.target.value)}
                                  rows={2} placeholder="编辑回复…"
                                  className="w-full border border-primary-200 rounded-xl px-3 py-2 text-xs resize-none
                                             focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white" />
                                {editReplyError && (
                                  <p className="text-xs text-red-500 mt-1">{editReplyError}</p>
                                )}
                                <div className="flex gap-2 mt-1.5">
                                  <button onClick={() => { setEditingReplyId(null); setEditReplyError(null) }}
                                    className="flex items-center gap-0.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">
                                    <X size={11} /> 取消
                                  </button>
                                  <button onClick={() => saveReply(r.id)} disabled={editReplySubmitting || !editReplyText.trim()}
                                    className="flex items-center gap-0.5 text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 transition-colors">
                                    <Check size={11} /> {editReplySubmitting ? '保存中…' : '保存'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                          // No reply yet — show reply button for provider
                          if (!reply && isOwnService) return (
                            replyingId === r.id ? (
                              <div className="mt-3 flex gap-2">
                                <CornerDownRight size={14} className="text-primary-300 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                                    rows={2} placeholder="回复这条评价…"
                                    className="w-full border border-primary-200 rounded-xl px-3 py-2 text-xs resize-none
                                               focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white" />
                                  {replyError && <p className="text-xs text-red-500 mt-0.5">{replyError}</p>}
                                  <div className="flex gap-2 mt-1.5">
                                    <button onClick={() => setReplyingId(null)}
                                      className="flex items-center gap-0.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">
                                      <X size={11} /> 取消
                                    </button>
                                    <button onClick={() => submitReply(r.id)} disabled={replySubmitting || !replyText.trim()}
                                      className="flex items-center gap-0.5 text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 transition-colors">
                                      <Send size={11} /> {replySubmitting ? '回复中…' : '回复'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => openReply(r.id)}
                                className="mt-2 flex items-center gap-1 text-[11px] text-primary-500 hover:text-primary-700 transition-colors">
                                <MessageCircle size={11} /> 回复此评价
                              </button>
                            )
                          )
                          return null
                        })()}
                      </>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {reviews.length > 1 && (
            <p className="text-[11px] text-gray-400 text-center pt-1">
              评价按"有帮助"票数排序
            </p>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} size={size}
          className={s <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
      ))}
    </div>
  )
}

function StarPicker({ rating, hover, onPick, onHover }:
  { rating: number; hover: number; onPick: (n: number) => void; onHover: (n: number) => void }) {
  const labels = ['', '很差', '较差', '一般', '不错', '非常好']
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button" onClick={() => onPick(s)}
          onMouseEnter={() => onHover(s)} onMouseLeave={() => onHover(0)}
          className="focus:outline-none">
          <Star size={28}
            className={`transition-colors ${s <= (hover || rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
        </button>
      ))}
      {(hover || rating) > 0 && (
        <span className="text-xs text-gray-500 ml-1">{labels[hover || rating]}</span>
      )}
    </div>
  )
}
