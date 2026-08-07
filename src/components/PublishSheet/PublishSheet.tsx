// ─── PublishSheet ───────────────────────────────────────────────────────────
// Single publish entry point: the BottomNav「+」opens this bottom sheet, which
// fans out to every publish flow. Replaces the old 3-way conflict (center FAB
// 发服务 + orange FAB 发需求 + inline card) with one consistent panel.
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { Wrench, Megaphone, MessageSquareText, CalendarPlus, Briefcase, ShoppingBag, Home } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useInquiryStore } from '../../store/inquiryStore'

interface Props { open: boolean; onClose: () => void }

// 发需求走弹窗(inquiry)而非路由；用 inquiry:true 标记。
type PublishOption = {
  key: string; label: string; sub: string; icon: typeof Wrench; color: string
  to?: string; inquiry?: boolean
}
const OPTIONS: PublishOption[] = [
  { key: 'services',    label: '服务卡片', sub: '我能提供的服务', to: '/post',            icon: Wrench,            color: 'text-primary-600 bg-primary-50' },
  { key: 'inquiry',     label: '发需求',   sub: 'AI 智能匹配 · 商家主动联系', inquiry: true,       icon: Megaphone,         color: 'text-orange-600 bg-orange-50' },
  { key: 'community',   label: '发帖子',   sub: '社区圈子',       to: '/community/post',  icon: MessageSquareText, color: 'text-rose-600 bg-rose-50' },
  { key: 'events',      label: '发活动',   sub: '同城聚会',       to: '/events/post',     icon: CalendarPlus,      color: 'text-violet-600 bg-violet-50' },
  { key: 'jobs',        label: '发招聘',   sub: '招聘 / 求职',    to: '/jobs/post',       icon: Briefcase,         color: 'text-blue-600 bg-blue-50' },
  { key: 'secondhand',  label: '发闲置',   sub: '二手转让',       to: '/secondhand/post', icon: ShoppingBag,       color: 'text-emerald-600 bg-emerald-50' },
  { key: 'realestate',  label: '发房源',   sub: '租房 / 买房',    to: '/realestate/post', icon: Home,              color: 'text-amber-600 bg-amber-50' },
]

// 当前所在板块 → 对应发布项的 key（无明确对应时返回 null，面板照常平铺）。
function currentSectionKey(pathname: string): string | null {
  if (pathname.startsWith('/secondhand')) return 'secondhand'
  if (pathname.startsWith('/jobs'))       return 'jobs'
  if (pathname.startsWith('/realestate')) return 'realestate'
  if (pathname.startsWith('/events'))     return 'events'
  if (pathname.startsWith('/plaza') || pathname.startsWith('/community')) return 'community'
  return null
}

export default function PublishSheet({ open, onClose }: Props) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const openInquiry     = useInquiryStore((s) => s.openInquiry)
  const pageCategoryId  = useInquiryStore((s) => s.pageCategoryId)

  function go(to: string) {
    onClose()
    if (!user) { navigate('/login', { state: { from: to } }); return }
    navigate(to)
  }

  // 发需求：就地打开发需求弹窗，并预填当前页类别（类别页/搜索页/服务详情）。
  function goInquiry() {
    onClose()
    if (!user) { navigate('/login', { state: { from: '/?inquiry=1' } }); return }
    openInquiry(pageCategoryId)
  }

  const trigger = (o: PublishOption) => (o.inquiry ? goInquiry() : go(o.to!))

  // 当前板块对应的发布项 → 置顶变大高亮；其余照常平铺。
  const currentKey  = currentSectionKey(pathname)
  const highlighted = currentKey ? OPTIONS.find((o) => o.key === currentKey) ?? null : null
  const rest        = highlighted ? OPTIONS.filter((o) => o !== highlighted) : OPTIONS

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

            {/* 当前板块：置顶大卡片高亮 */}
            {highlighted && (() => {
              const Icon = highlighted.icon
              return (
                <button onClick={() => trigger(highlighted)}
                  className="w-full flex items-center gap-3 p-3 mb-3 rounded-2xl border-2 border-primary-500
                             bg-primary-50/50 active:scale-[0.98] transition-all">
                  <span className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${highlighted.color}`}>
                    <Icon size={26} />
                  </span>
                  <span className="flex-1 text-left">
                    <span className="block text-base font-bold text-gray-900">{highlighted.label}</span>
                    <span className="block text-xs text-gray-500">{highlighted.sub}</span>
                  </span>
                  <span className="text-[10px] font-semibold text-primary-600 bg-primary-100 rounded-full px-2 py-0.5 flex-shrink-0">
                    当前板块
                  </span>
                </button>
              )
            })()}

            <div className="grid grid-cols-3 gap-2.5">
              {rest.map((o) => {
                const Icon = o.icon
                return (
                  <button key={o.key} onClick={() => trigger(o)}
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
