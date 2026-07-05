import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ProviderReview } from '../types'

interface Props {
  reviews: ProviderReview[]
}

export default function ReviewsSection({ reviews }: Props) {
  const navigate = useNavigate()
  const [starFilter, setStarFilter] = useState(0)

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
      </div>

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
                  <img loading="lazy" src={r.reviewer.avatar_url} alt={r.reviewer.name}
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
