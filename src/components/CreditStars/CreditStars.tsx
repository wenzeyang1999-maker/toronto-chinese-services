// ─── CreditStars ──────────────────────────────────────────────────────────────
// Renders a 0–5 star credit rating + the /10 score. Tap to expand a breakdown
// showing which verification items are earned vs. still available.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Check, ChevronRight, X } from 'lucide-react'
import { computeCreditScore, CREDIT_MAX, type CreditInput } from '../../lib/creditScore'

interface Props {
  input: CreditInput
  /** Show the breakdown popup on tap. Default true. Set false for read-only contexts. */
  interactive?: boolean
  size?: number
}

function StarRow({ stars, size }: { stars: number; size: number }) {
  // stars is 0–5, may be fractional (e.g. 3.5)
  return (
    <span className="inline-flex items-center" aria-label={`${stars} 星`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, stars - i)) // 0, 0.5, or 1 per star
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-gray-200" fill="currentColor" />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star size={size} className="text-amber-400" fill="currentColor" />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

export default function CreditStars({ input, interactive = true, size = 14 }: Props) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const { score, stars, breakdown } = computeCreditScore(input)

  const stars1dp = Math.round(stars * 10) / 10

  return (
    <>
      <button
        type="button"
        onClick={interactive ? () => setOpen(true) : undefined}
        className={`inline-flex items-center gap-1.5 ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
        aria-label={`信用分 ${score} 分`}
      >
        <StarRow stars={stars} size={size} />
        <span className="text-xs font-semibold text-gray-600">
          {score}<span className="text-gray-400">/{CREDIT_MAX}</span> 信用分
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 px-4 pb-8 sm:pb-0"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-900">信用分明细</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <StarRow stars={stars} size={20} />
              <span className="text-lg font-bold text-gray-900">{score}<span className="text-sm text-gray-400 font-normal">/{CREDIT_MAX}</span></span>
              <span className="text-xs text-gray-400">（{stars1dp} 星）</span>
            </div>

            <ul className="space-y-2">
              {breakdown.map((item) => (
                <li key={item.label}>
                  {item.earned ? (
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-green-50">
                      <Check size={16} className="text-green-600 flex-shrink-0" />
                      <span className="flex-1 text-sm font-medium text-green-800">{item.label}</span>
                      <span className="text-sm font-bold text-green-700">+{item.points}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => { if (item.actionUrl) { setOpen(false); navigate(item.actionUrl) } }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <span className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                      <span className="flex-1 text-sm font-medium text-gray-600 text-left">{item.label}</span>
                      <span className="text-sm font-semibold text-gray-400">+{item.points}</span>
                      {item.actionUrl && <ChevronRight size={15} className="text-gray-300" />}
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <p className="text-xs text-gray-400 mt-4 leading-relaxed">
              信用分根据账号验证情况计算，完成验证可提升星级，让客户更信任你。
              更多维度（评价、回复速度等）将在后续版本加入。
            </p>
          </div>
        </div>
      )}
    </>
  )
}
