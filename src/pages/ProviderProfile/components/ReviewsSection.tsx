import { useState } from 'react'
import { cdnUrl } from '../../../lib/cdnUrl'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, PenLine, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ProviderReview } from '../types'
import { supabase } from '../../../lib/supabase'
import { toast } from '../../../lib/toast'

interface Props {
  reviews: ProviderReview[]
  providerId?: string        // 可写评价时传入
  canReview?: boolean        // 已登录 且 非本人
  onReviewed?: () => void     // 提交成功 → 上层重载
}

export default function ReviewsSection({ reviews, providerId, canReview, onReviewed }: Props) {
  const navigate = useNavigate()
  const [starFilter, setStarFilter] = useState(0)
  const [open, setOpen] = useState(false)
  const [myRating, setMyRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submitReview() {
    if (!providerId) return
    if (myRating === 0) { toast('请选择星级', 'error'); return }
    setSubmitting(true)
    const { error } = await supabase.rpc('submit_provider_review', {
      p_provider: providerId, p_rating: myRating, p_comment: comment.trim() || null,
    })
    setSubmitting(false)
    if (error) { toast('提交失败：' + error.message, 'error'); return }
    toast('评价已提交 ✓', 'success')
    setOpen(false); setMyRating(0); setComment('')
    onReviewed?.()
  }

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-sm font-semibold text-gray-500">
          收到的评价（{reviews.length}）
          {reviews.length > 0 && (
            <span className="ml-2 text-yellow-500 font-bold">
              {'★ ' + avgRating.toFixed(1)}
            </span>
          )}
        </h2>
        {canReview && providerId && (
          <button onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-full transition-colors">
            <PenLine size={13} /> 写评价
          </button>
        )}
      </div>

      {/* 写评价弹窗 */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center px-4"
            onClick={() => !submitting && setOpen(false)}>
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-gray-900">给这位商家评价</h3>
                <button onClick={() => setOpen(false)} className="text-gray-400"><X size={18} /></button>
              </div>
              <div className="flex items-center justify-center gap-1.5 mb-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setMyRating(n)} className="active:scale-90 transition">
                    <Star size={32} className={n <= myRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                  </button>
                ))}
              </div>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300}
                placeholder="说说你的体验（选填）"
                className="w-full h-24 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400 resize-none mb-3" />
              <button onClick={submitReview} disabled={submitting}
                className="w-full rounded-2xl bg-primary-600 text-white font-semibold py-3 hover:bg-primary-700 disabled:opacity-50">
                {submitting ? '提交中…' : '提交评价'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {reviews.length > 0 && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {[0, 5, 4, 3, 2, 1].map(star => {
            const count = star === 0 ? reviews.length : reviews.filter(r => r.rating === star).length
            if (star !== 0 && count === 0) return null
            return (
              <button key={star} onClick={() => setStarFilter(star)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  starFilter === star
                    ? 'bg-yellow-400 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-yellow-300'
                }`}>
                {star === 0 ? `全部 (${count})` : `${'★'.repeat(star)} (${count})`}
              </button>
            )
          })}
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center text-gray-400 text-sm">
          暂无评价
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          <AnimatePresence>
            {reviews
              .filter(r => starFilter === 0 || r.rating === starFilter)
              .map((r, i) => (
              <motion.div key={r.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex gap-3 p-4"
              >
                {r.reviewer?.avatar_url ? (
                  <img loading="lazy" src={cdnUrl(r.reviewer.avatar_url, 160)} alt={r.reviewer.name}
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
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={12}
                          className={s <= r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
                      ))}
                    </div>
                    <span className="text-xs text-gray-400 ml-auto">{r.created_at.slice(0, 10)}</span>
                  </div>
                  {r.service && (
                    <button onClick={() => navigate(`/service/${r.service!.id}`)}
                      className="text-xs text-primary-500 hover:underline mt-0.5">
                      {r.service.title}
                    </button>
                  )}
                  {r.comment && (
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">{r.comment}</p>
                  )}
                  {r.reply && (
                    <div className="mt-2 flex gap-1.5">
                      <div className="w-0.5 bg-primary-200 rounded-full flex-shrink-0" />
                      <div className="bg-primary-50 rounded-lg px-3 py-2 flex-1">
                        <p className="text-xs font-semibold text-primary-600 mb-0.5">🏪 商家回复</p>
                        <p className="text-xs text-gray-600 leading-relaxed">{r.reply}</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
