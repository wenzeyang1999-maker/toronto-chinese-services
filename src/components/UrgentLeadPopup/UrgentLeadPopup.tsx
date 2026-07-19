// ─── UrgentLeadPopup ──────────────────────────────────────────────────────────
// Full-attention in-app card shown to an online provider when a matching URGENT
// request arrives (driven by useUrgentAlertStore + useUrgentRequestAlerts).
// Slides down from the top with a pulsing red header; the provider can jump to
// the request or dismiss. Auto-dismisses after 40s so a stale lead doesn't linger.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Siren, X, ChevronRight, MapPin } from 'lucide-react'
import { useUrgentAlertStore } from '../../store/urgentAlertStore'
import { getCategoryById } from '../../data/categories'
import type { ServiceCategory } from '../../types'

export default function UrgentLeadPopup() {
  const navigate = useNavigate()
  const alert = useUrgentAlertStore(s => s.alert)
  const clear = useUrgentAlertStore(s => s.clear)

  // Auto-dismiss after 40s
  useEffect(() => {
    if (!alert) return
    const t = setTimeout(clear, 40_000)
    return () => clearTimeout(t)
  }, [alert, clear])

  const cat = alert?.category ? getCategoryById(alert.category as ServiceCategory) : null

  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          key={alert.id}
          initial={{ y: -120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="fixed top-3 inset-x-3 md:inset-x-auto md:right-5 md:w-96 z-[80]
                     bg-white rounded-2xl shadow-2xl overflow-hidden border border-red-200"
          style={{ boxShadow: '0 12px 40px rgba(220,38,38,0.30)' }}
        >
          {/* Pulsing red header */}
          <div className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2.5">
            <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Siren size={16} className="text-white animate-pulse" />
            </span>
            <p className="text-sm font-bold text-white flex-1">🚨 新紧急单！客户急需服务</p>
            <button onClick={clear}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 text-white/80">
              <X size={15} />
            </button>
          </div>

          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-1.5">
              {cat && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
                  {cat.emoji} {cat.label}
                </span>
              )}
              {alert.area && (
                <span className="text-[11px] text-gray-500 flex items-center gap-0.5">
                  <MapPin size={11} className="text-gray-400" /> {alert.area}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-800 font-medium leading-snug line-clamp-2">{alert.title}</p>

            <button
              onClick={() => { navigate(`/requests/${alert.id}`); clear() }}
              className="mt-1 w-full flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700
                         text-white text-sm font-bold py-2.5 rounded-xl transition-colors active:scale-95"
            >
              立即查看并联系客户 <ChevronRight size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
