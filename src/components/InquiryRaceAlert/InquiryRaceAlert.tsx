// ─── InquiryRaceAlert ─────────────────────────────────────────────────────────
// Shown to providers when a new inquiry matching their category arrives.
// Slide-in banner with a countdown and "抢单" button.
// After clicking, calls accept_inquiry RPC — shows slot count or "已满" feedback.
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, X, CheckCircle, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import type { IncomingInquiry } from '../../hooks/useInquiryRaceAlerts'

const TIMING_LABEL: Record<string, string> = {
  asap:      '急需，尽快',
  next_week: '下周内',
  flexible:  '时间灵活',
}

const CLAIM_TTL = 90 // seconds to keep alert visible

interface Props {
  inquiry: IncomingInquiry
  onDismiss: () => void
}

export default function InquiryRaceAlert({ inquiry, onDismiss }: Props) {
  const user    = useAuthStore((s) => s.user)
  const [state, setState] = useState<'idle' | 'claiming' | 'claimed' | 'full' | 'error'>('idle')
  const [slotCount, setSlotCount] = useState<number | null>(null)
  const [seconds,  setSeconds]   = useState(CLAIM_TTL)

  // Countdown auto-dismiss
  useEffect(() => {
    if (state === 'claimed' || state === 'full') return
    const id = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(id); onDismiss(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [state])

  async function handleClaim() {
    if (!user) return
    setState('claiming')
    try {
      const { data, error } = await supabase.rpc('accept_inquiry', {
        p_inquiry_id: inquiry.id,
        p_provider_id: user.id,
      })
      if (error) throw error
      const result = data as { ok: boolean; count?: number; error?: string; already_accepted?: boolean }
      if (!result.ok) {
        if (result.error === 'full') { setState('full'); return }
        throw new Error(result.error)
      }
      setSlotCount(result.count ?? null)
      setState(result.already_accepted ? 'claimed' : 'claimed')
    } catch {
      setState('error')
    }
  }

  return (
    <motion.div
      initial={{ x: '110%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '110%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="fixed top-20 right-3 z-[70] w-72 bg-white rounded-2xl shadow-xl border border-primary-100 overflow-hidden"
    >
      {/* Countdown bar */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: CLAIM_TTL, ease: 'linear' }}
        style={{ transformOrigin: 'left' }}
        className="h-0.5 bg-primary-400 w-full"
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
              <Zap size={16} className="text-primary-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-primary-600">新询价！先到先得</p>
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <Clock size={10} /> 剩余 {seconds}s
              </p>
            </div>
          </div>
          <button onClick={onDismiss} className="text-gray-300 hover:text-gray-500 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Category + details */}
        <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-1.5">
          <p className="text-sm font-semibold text-gray-800">{inquiry.categoryLabel}</p>
          {inquiry.description && (
            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{inquiry.description}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">
              ⏰ {TIMING_LABEL[inquiry.timing] ?? inquiry.timing}
            </span>
            {inquiry.budget && (
              <span className="text-[10px] bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">
                💰 ${inquiry.budget}
              </span>
            )}
          </div>
        </div>

        {/* Action */}
        {state === 'idle' && (
          <button onClick={handleClaim}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold
                       rounded-xl transition-colors active:scale-95 flex items-center justify-center gap-2">
            <Zap size={14} /> 抢单
          </button>
        )}
        {state === 'claiming' && (
          <div className="w-full py-2.5 flex items-center justify-center gap-2 text-sm text-gray-500">
            <span className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            抢单中…
          </div>
        )}
        {state === 'claimed' && (
          <div className="w-full py-2.5 flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
              <CheckCircle size={16} /> 抢单成功！
            </div>
            {slotCount != null && (
              <p className="text-[11px] text-gray-400">当前 {slotCount}/5 名服务商已接单</p>
            )}
            <p className="text-xs text-gray-500 text-center mt-1">客户将通过您留的联系方式与您联系</p>
          </div>
        )}
        {state === 'full' && (
          <div className="w-full py-2 text-center">
            <p className="text-sm font-semibold text-gray-500">名额已满 😔</p>
            <p className="text-xs text-gray-400 mt-0.5">5 名服务商已接单</p>
          </div>
        )}
        {state === 'error' && (
          <button onClick={handleClaim}
            className="w-full py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold
                       rounded-xl hover:bg-gray-200 transition-colors">
            重试
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Container: manages a queue of incoming inquiry alerts ───────────────────
export function InquiryRaceAlertContainer({ inquiries, onDismiss }: {
  inquiries: IncomingInquiry[]
  onDismiss: (id: string) => void
}) {
  return (
    <div className="fixed top-0 right-0 z-[70] flex flex-col gap-2 p-3 pointer-events-none">
      <AnimatePresence>
        {inquiries.map((inq) => (
          <div key={inq.id} className="pointer-events-auto">
            <InquiryRaceAlert inquiry={inq} onDismiss={() => onDismiss(inq.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
