// ─── Reviews Section ────────────────────────────────────────────────────────
// Displays reviews for a service and lets logged-in users submit one.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Send } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

interface Review {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer: {
    id: string
    name: string
    avatar_url: string | null
  }
}

interface Props {
  serviceId: string
  providerId: string
}

export default function ReviewsSection({ serviceId, providerId }: Props) {
  const navigate   = useNavigate()
  const user       = useAuthStore((s) => s.user)

  const [reviews,      setReviews]      = useState<Review[]>([])
  const [loading,      setLoading]      = useState(true)
  const [myRating,     setMyRating]     = useState(0)
  const [hoverRating,  setHoverRating]  = useState(0)
  const [comment,      setComment]      = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [alreadyReviewed, setAlreadyReviewed] = useState(false)
  const [submitError,  setSubmitError]  = useState<string | null>(null)

  const isOwnService = user?.id === providerId

  function load() {
    supabase
      .from('reviews')
      .select('id, rating, comment, created_at, reviewer:reviewer_id(id, name, avatar_url)')
      .eq('service_id', serviceId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) { setLoading(false); return }
        const rows = data.map((r: any) => ({
          id:         r.id,
          rating:     r.rating,
          comment:    r.comment,
          created_at: r.created_at,
          reviewer:   Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer,
        })) as Review[]
        setReviews(rows)
        if (user) setAlreadyReviewed(rows.some(r => r.reviewer?.id === user.id))
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [serviceId, user?.id])

  async function submit() {
    if (!user) { navigate('/login'); return }
    if (myRating === 0) { setSubmitError('请选择星级'); return }
    setSubmitting(true)
    setSubmitError(null)
    const { error } = await supabase.from('reviews').insert({
      service_id:  serviceId,
      reviewer_id: user.id,
      rating:      myRating,
      comment:     comment.trim() || null,
    })
    setSubmitting(false)
    if (error) {
      setSubmitError(error.code === '23505' ? '您已经评价过这个服务了' : '提交失败，请稍后再试')
    } else {
      setMyRating(0)
      setComment('')
      setAlreadyReviewed(true)
      load()
    }
  }

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="card p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">用户评价</h3>
        {reviews.length > 0 && (
          <div className="flex items-center gap-1.5">
            <StarDisplay rating={avgRating} size={14} />
            <span className="text-sm font-bold text-gray-800">{avgRating.toFixed(1)}</span>
            <span className="text-xs text-gray-400">（{reviews.length} 条）</span>
          </div>
        )}
      </div>

      {/* Submit form — only for non-owners who haven't reviewed yet */}
      {!isOwnService && !alreadyReviewed && (
        <div className="bg-gray-50 rounded-2xl p-4 mb-4">
          <p className="text-xs font-medium text-gray-600 mb-3">
            {user ? '写下您的评价' : '登录后可以留下评价'}
          </p>

          {/* Star picker */}
          <div className="flex items-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setMyRating(s)}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                className="focus:outline-none"
              >
                <Star
                  size={28}
                  className={`transition-colors ${
                    s <= (hoverRating || myRating)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
            {myRating > 0 && (
              <span className="text-xs text-gray-500 ml-2">
                {['', '很差', '较差', '一般', '不错', '非常好'][myRating]}
              </span>
            )}
          </div>

          {/* Comment */}
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="分享您的使用体验（选填）"
            rows={3}
            disabled={!user}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none
                       focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white
                       disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {submitError && (
            <p className="text-xs text-red-500 mt-1">{submitError}</p>
          )}

          <button
            onClick={user ? submit : () => navigate('/login')}
            disabled={submitting}
            className="mt-2 flex items-center gap-2 bg-primary-600 text-white text-sm font-medium
                       px-5 py-2 rounded-xl hover:bg-primary-700 disabled:opacity-60 transition-colors"
          >
            <Send size={14} />
            {submitting ? '提交中…' : user ? '提交评价' : '登录后评价'}
          </button>
        </div>
      )}

      {alreadyReviewed && !isOwnService && (
        <div className="bg-green-50 text-green-700 text-xs rounded-xl px-4 py-2.5 mb-4 font-medium">
          ✓ 您已评价过此服务
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
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">
                      {r.reviewer?.name ?? '匿名用户'}
                    </span>
                    <StarDisplay rating={r.rating} size={12} />
                    <span className="text-xs text-gray-400 ml-auto">
                      {r.created_at.slice(0, 10)}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">{r.comment}</p>
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
function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          size={size}
          className={s <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}
        />
      ))}
    </div>
  )
}
