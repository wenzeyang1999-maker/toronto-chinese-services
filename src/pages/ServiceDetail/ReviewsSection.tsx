// ─── Reviews Section ────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Send, Pencil, X, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

interface Review {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer: { id: string; name: string; avatar_url: string | null }
}

interface Props {
  serviceId: string
  providerId: string
}

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

  const isOwnService    = user?.id === providerId
  const myReview        = reviews.find(r => r.reviewer?.id === user?.id)
  const alreadyReviewed = !!myReview

  function load() {
    supabase
      .from('reviews')
      .select('id, rating, comment, created_at, reviewer:reviewer_id(id, name, avatar_url)')
      .eq('service_id', serviceId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) { setLoading(false); return }
        setReviews(data.map((r: any) => ({
          id:         r.id,
          rating:     r.rating,
          comment:    r.comment,
          created_at: r.created_at,
          reviewer:   Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer,
        })) as Review[])
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [serviceId, user?.id])

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
    }
  }

  function startEdit(r: Review) {
    setEditingId(r.id)
    setEditRating(r.rating)
    setEditComment(r.comment ?? '')
    setEditError(null)
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
      .eq('id', editingId)
      .eq('reviewer_id', user.id)
    setEditSubmitting(false)
    if (error) { setEditError('保存失败，请稍后再试') }
    else { cancelEdit(); load() }
  }

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
        <div className="space-y-4">
          <AnimatePresence>
            {reviews.map((r, i) => (
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
                        {user?.id === r.reviewer?.id && (
                          <button onClick={() => startEdit(r)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 transition-colors">
                            <Pencil size={11} /> 编辑
                          </button>
                        )}
                      </div>
                      {r.comment && (
                        <p className="text-sm text-gray-600 mt-1 leading-relaxed">{r.comment}</p>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
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
