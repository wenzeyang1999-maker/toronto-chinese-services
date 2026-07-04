// ─── PublishSheet ───────────────────────────────────────────────────────────
// Single publish entry point: the BottomNav「+」opens this bottom sheet, which
// fans out to every publish flow. Replaces the old 3-way conflict (center FAB
// 发服务 + orange FAB 发需求 + inline card) with one consistent panel.
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Wrench, Megaphone, MessageSquareText, CalendarPlus, Briefcase, ShoppingBag, Home } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

interface Props { open: boolean; onClose: () => void }

const OPTIONS = [
  { label: '发服务',   sub: '我能提供的服务', to: '/post',            icon: Wrench,            color: 'text-primary-600 bg-primary-50' },
  { label: '发需求',   sub: '我需要找人做',   to: '/requests/post',   icon: Megaphone,         color: 'text-orange-600 bg-orange-50' },
  { label: '发帖子',   sub: '社区圈子',       to: '/community/post',  icon: MessageSquareText, color: 'text-rose-600 bg-rose-50' },
  { label: '发活动',   sub: '同城聚会',       to: '/events/post',     icon: CalendarPlus,      color: 'text-violet-600 bg-violet-50' },
  { label: '发招聘',   sub: '招聘 / 求职',    to: '/jobs/post',       icon: Briefcase,         color: 'text-blue-600 bg-blue-50' },
  { label: '发闲置',   sub: '二手转让',       to: '/secondhand/post', icon: ShoppingBag,       color: 'text-emerald-600 bg-emerald-50' },
  { label: '发房源',   sub: '租房 / 买房',    to: '/realestate/post', icon: Home,              color: 'text-amber-600 bg-amber-50' },
]

export default function PublishSheet({ open, onClose }: Props) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  function go(to: string) {
    onClose()
    if (!user) { navigate('/login', { state: { from: to } }); return }
    navigate(to)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="ps-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-[60] md:hidden"
          />
          <motion.div key="ps-sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="fixed bottom-0 inset-x-0 z-[61] md:hidden bg-white rounded-t-3xl px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-2xl"
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-800 text-center mb-3">发布</p>
            <div className="grid grid-cols-3 gap-2.5">
              {OPTIONS.map((o) => {
                const Icon = o.icon
                return (
                  <button key={o.to} onClick={() => go(o.to)}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-2xl hover:bg-gray-50 active:scale-95 transition-all">
                    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center ${o.color}`}>
                      <Icon size={20} />
                    </span>
                    <span className="text-xs font-semibold text-gray-800">{o.label}</span>
                    <span className="text-[10px] text-gray-400 leading-none">{o.sub}</span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
