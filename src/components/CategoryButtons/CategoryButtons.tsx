import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ChevronRight, type LucideIcon,
  Home, Recycle, MapPin, MessageSquare,
  Truck, Sparkles, Car, Leaf, Hammer, Wrench,
  Sofa, Plane, ShoppingBag,
  Calendar, ShoppingCart, Heart,
  Gauge, Shield, ParkingCircle,
} from 'lucide-react'

// ── Toggle: true = Lucide icons, false = emoji ──────────────────────────────
const USE_ICONS = true

interface SubCat {
  emoji: string
  icon: LucideIcon
  label: string
  q: string           // search keyword
  sectionLabel?: string  // optional section divider before this item
}

interface L1Category {
  id: string
  label: string
  emoji: string
  icon: LucideIcon
  color: string
  bgColor: string
  headerColor: string  // for sheet header
  desc: string
  to: string | null    // direct nav (no sheet)
  subs?: SubCat[]
}

const TOP_CATEGORIES: L1Category[] = [
  {
    id: 'life',
    label: '生活服务',
    emoji: '🏠', icon: Home,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    headerColor: 'from-blue-500 to-blue-700',
    desc: '搬家·保洁·接送·装修',
    to: '/search',
    subs: [
      { emoji: '🚚', icon: Truck,       label: '搬运',   q: '搬运' },
      { emoji: '✨', icon: Sparkles,    label: '保洁',   q: '保洁' },
      { emoji: '🚗', icon: Car,         label: '接送',   q: '接送' },
      { emoji: '🌿', icon: Leaf,        label: '园艺',   q: '园艺' },
      { emoji: '🔨', icon: Hammer,      label: '装修',   q: '装修' },
      { emoji: '🔧', icon: Wrench,      label: '水电维修', q: '水电维修' },
      // 汽车服务
      { emoji: '🚘', icon: Gauge,       label: '汽车维修', q: '汽车维修', sectionLabel: '汽车服务' },
      { emoji: '🧹', icon: Wrench,       label: '洗车美容', q: '洗车' },
      { emoji: '🛡️', icon: Shield,      label: '汽车保险', q: '汽车保险' },
      { emoji: '🅿️', icon: ParkingCircle, label: '道路救援', q: '道路救援' },
    ],
  },
  {
    id: 'secondhand',
    label: '二手交易',
    emoji: '♻️', icon: Recycle,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    headerColor: 'from-teal-500 to-teal-700',
    desc: '家具·家电·汽车摩托',
    to: '/secondhand',
    subs: [
      { emoji: '🛋️', icon: Sofa,       label: '家具家电', q: '家具' },
      { emoji: '🚗', icon: Car,         label: '汽车摩托', q: '汽车' },
      { emoji: '✈️', icon: Plane,       label: '船艇飞机', q: '船艇' },
      { emoji: '🎽', icon: ShoppingBag, label: '各类装备', q: '装备' },
    ],
  },
  {
    id: 'plaza',
    label: '大多广场',
    emoji: '🎪', icon: MapPin,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    headerColor: 'from-pink-500 to-pink-700',
    desc: '同城活动·集市·公益',
    to: '/events',
    subs: [
      { emoji: '🎉', icon: Calendar,     label: '同城活动', q: '' },
      { emoji: '🛒', icon: ShoppingCart, label: '集市摊位', q: '' },
      { emoji: '❤️', icon: Heart,        label: '公益慈善', q: '' },
    ],
  },
  {
    id: 'community',
    label: '多村论坛',
    emoji: '💬', icon: MessageSquare,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    headerColor: 'from-indigo-500 to-indigo-700',
    desc: '社区讨论·经验分享',
    to: '/community',
  },
]

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
}

export default function CategoryButtons() {
  const navigate = useNavigate()
  const [activeSheet, setActiveSheet] = useState<L1Category | null>(null)

  function handleClick(cat: L1Category) {
    // No subcategories → direct nav
    if (!cat.subs || cat.subs.length === 0) {
      if (cat.to) navigate(cat.to)
      return
    }
    // Has subcategories → open sheet
    setActiveSheet(cat)
  }

  function handleSubClick(cat: L1Category, sub: SubCat) {
    setActiveSheet(null)
    if (sub.q) {
      navigate(`/search?q=${encodeURIComponent(sub.q)}`)
    } else if (cat.to) {
      navigate(cat.to)
    }
  }

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {TOP_CATEGORIES.map((cat) => (
          <motion.button
            key={cat.id}
            variants={itemVariants}
            whileTap={{ scale: 0.93 }}
            onClick={() => handleClick(cat)}
            className={`relative ${cat.bgColor} rounded-2xl p-4 flex flex-col items-center gap-2
                        border border-white/60 hover:shadow-md active:brightness-95 transition-all`}
          >
            {USE_ICONS
              ? <cat.icon size={28} strokeWidth={1.5} className={cat.color} />
              : <span className="text-3xl leading-none">{cat.emoji}</span>
            }
            <span className={`text-sm font-semibold ${cat.color}`}>{cat.label}</span>
            <span className="text-xs text-gray-500 text-center leading-tight line-clamp-2">
              {cat.desc}
            </span>
          </motion.button>
        ))}
      </motion.div>

      {/* Floating popup */}
      <AnimatePresence>
        {activeSheet && (
          <>
            {/* Backdrop — light blur, very faint */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveSheet(null)}
              className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-50"
            />

            {/* Floating card — centered, NOT full-width bottom sheet */}
            <motion.div
              key="sheet"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="fixed inset-x-4 top-[38%] -translate-y-1/2 z-50
                         bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl
                         border border-white/60 max-w-sm mx-auto"
            >
              {/* Header — no gradient, just a subtle accent strip */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3
                              border-b border-gray-100/80">
                <div className="flex items-center gap-2">
                  <span className={`w-8 h-8 rounded-xl ${activeSheet.bgColor} flex items-center justify-center`}>
                    {USE_ICONS
                      ? <activeSheet.icon size={18} strokeWidth={1.5} className={activeSheet.color} />
                      : <span className="text-lg">{activeSheet.emoji}</span>
                    }
                  </span>
                  <div>
                    <p className={`text-sm font-bold ${activeSheet.color}`}>{activeSheet.label}</p>
                    <p className="text-[11px] text-gray-400 leading-none mt-0.5">选择服务类型</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveSheet(null)}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center
                             text-gray-400 hover:bg-gray-200 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Subcategories */}
              <div className="p-4 grid grid-cols-3 gap-2.5">
                {activeSheet.subs?.map((sub) => (
                  <div key={sub.label} className="contents">
                    {sub.sectionLabel && (
                      <div className="col-span-3 flex items-center gap-2 mt-1 mb-0.5">
                        <div className="flex-1 h-px bg-gray-100" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1">
                          {sub.sectionLabel}
                        </span>
                        <div className="flex-1 h-px bg-gray-100" />
                      </div>
                    )}
                    <button
                      onClick={() => handleSubClick(activeSheet, sub)}
                      className="bg-white/70 hover:bg-white rounded-2xl p-3 flex flex-col items-center gap-1.5
                                 border border-gray-100 hover:border-gray-200 hover:shadow-sm
                                 active:scale-95 transition-all"
                    >
                      {USE_ICONS
                        ? <sub.icon size={22} strokeWidth={1.5} className={activeSheet.color} />
                        : <span className="text-2xl leading-none">{sub.emoji}</span>
                      }
                      <span className={`text-xs font-semibold ${activeSheet.color} text-center leading-tight`}>
                        {sub.label}
                      </span>
                    </button>
                  </div>
                ))}
              </div>

              {/* View all link */}
              {activeSheet.to && (
                <button
                  onClick={() => { setActiveSheet(null); navigate(activeSheet.to!) }}
                  className="w-full flex items-center justify-center gap-1 py-3 text-xs text-gray-400
                             hover:text-gray-600 border-t border-gray-100/80 transition-colors rounded-b-3xl"
                >
                  查看{activeSheet.label}全部 <ChevronRight size={12} />
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
