import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight } from 'lucide-react'

interface SubCat {
  emoji: string
  label: string
  q: string       // search keyword
}

interface L1Category {
  id: string
  label: string
  emoji: string
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
    emoji: '🏠',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    headerColor: 'from-blue-500 to-blue-700',
    desc: '搬家·保洁·接送·装修',
    to: '/search',
    subs: [
      { emoji: '🚚', label: '搬运', q: '搬运' },
      { emoji: '✨', label: '保洁', q: '保洁' },
      { emoji: '🚗', label: '接送', q: '接送' },
      { emoji: '🌿', label: '园艺', q: '园艺' },
      { emoji: '🔨', label: '装修', q: '装修' },
      { emoji: '🔧', label: '水电维修', q: '水电维修' },
    ],
  },
  {
    id: 'realestate',
    label: '房产服务',
    emoji: '🏢',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    headerColor: 'from-green-500 to-green-700',
    desc: '地产经纪·房产出售·出租',
    to: '/realestate',
    subs: [
      { emoji: '🤝', label: '地产经纪', q: '地产经纪' },
      { emoji: '🏠', label: '房产出售', q: '房产出售' },
      { emoji: '🔑', label: '整租', q: '整租' },
      { emoji: '🛏️', label: '合租', q: '合租' },
    ],
  },
  {
    id: 'auto',
    label: '汽车服务',
    emoji: '🚘',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    headerColor: 'from-orange-500 to-orange-700',
    desc: '维修·轮胎·道路救援',
    to: null,
    subs: [
      { emoji: '🔩', label: '维修保养', q: '汽车维修' },
      { emoji: '🛞', label: '轮胎更换', q: '轮胎更换' },
      { emoji: '🆘', label: '紧急救援', q: '道路救援' },
    ],
  },
  {
    id: 'business',
    label: '商业服务',
    emoji: '🏭',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    headerColor: 'from-amber-500 to-amber-700',
    desc: '仓储·物流·建筑工程',
    to: null,
    subs: [
      { emoji: '📦', label: '仓库仓储', q: '仓储' },
      { emoji: '🚛', label: '物流运输', q: '物流运输' },
      { emoji: '⚙️', label: '设备安装', q: '设备安装' },
      { emoji: '🏗️', label: '建筑工程', q: '建筑工程' },
    ],
  },
  {
    id: 'pro',
    label: '专业服务',
    emoji: '⚖️',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    headerColor: 'from-purple-500 to-purple-700',
    desc: '法律·税务·保险',
    to: null,
    subs: [
      { emoji: '⚖️', label: '法律服务', q: '法律' },
      { emoji: '🧾', label: '税务服务', q: '税务' },
      { emoji: '🛡️', label: '保险服务', q: '保险' },
    ],
  },
  {
    id: 'study',
    label: '留学移民',
    emoji: '🎓',
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    headerColor: 'from-sky-500 to-sky-700',
    desc: '留学·签证·培训',
    to: null,
    subs: [
      { emoji: '🎓', label: '留学', q: '留学' },
      { emoji: '📋', label: '签证', q: '签证' },
      { emoji: '📚', label: '培训', q: '培训' },
    ],
  },
  {
    id: 'secondhand',
    label: '二手交易',
    emoji: '♻️',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    headerColor: 'from-teal-500 to-teal-700',
    desc: '家具·家电·汽车摩托',
    to: '/secondhand',
    subs: [
      { emoji: '🛋️', label: '家具家电', q: '家具' },
      { emoji: '🚗', label: '汽车摩托', q: '汽车' },
      { emoji: '✈️', label: '船艇飞机', q: '船艇' },
      { emoji: '🎽', label: '各类装备', q: '装备' },
    ],
  },
  {
    id: 'plaza',
    label: '大多广场',
    emoji: '🎪',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    headerColor: 'from-pink-500 to-pink-700',
    desc: '同城活动·集市·公益',
    to: '/events',
    subs: [
      { emoji: '🎉', label: '同城活动', q: '' },
      { emoji: '🛒', label: '集市摊位', q: '' },
      { emoji: '❤️', label: '公益慈善', q: '' },
    ],
  },
  {
    id: 'community',
    label: '多村论坛',
    emoji: '💬',
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
        className="grid grid-cols-3 gap-3"
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
            <span className="text-3xl leading-none">{cat.emoji}</span>
            <span className={`text-sm font-semibold ${cat.color}`}>{cat.label}</span>
            <span className="text-xs text-gray-500 text-center leading-tight line-clamp-2">
              {cat.desc}
            </span>
          </motion.button>
        ))}
      </motion.div>

      {/* Bottom sheet */}
      <AnimatePresence>
        {activeSheet && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveSheet(null)}
              className="fixed inset-0 bg-black/40 z-50"
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl
                         max-w-2xl mx-auto"
            >
              {/* Header */}
              <div className={`bg-gradient-to-r ${activeSheet.headerColor} rounded-t-3xl px-5 pt-5 pb-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{activeSheet.emoji}</span>
                    <span className="text-white font-bold text-lg">{activeSheet.label}</span>
                  </div>
                  <button
                    onClick={() => setActiveSheet(null)}
                    className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-white/70 text-xs mt-1">选择你需要的服务类型</p>
              </div>

              {/* Subcategories */}
              <div className="p-4 grid grid-cols-3 gap-3">
                {activeSheet.subs?.map((sub) => (
                  <button
                    key={sub.label}
                    onClick={() => handleSubClick(activeSheet, sub)}
                    className={`${activeSheet.bgColor} rounded-2xl p-3 flex flex-col items-center gap-1.5
                                border border-white/60 hover:shadow-md active:scale-95 transition-all`}
                  >
                    <span className="text-2xl leading-none">{sub.emoji}</span>
                    <span className={`text-xs font-semibold ${activeSheet.color} text-center leading-tight`}>
                      {sub.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* View all link */}
              {activeSheet.to && (
                <button
                  onClick={() => { setActiveSheet(null); navigate(activeSheet.to!) }}
                  className="w-full flex items-center justify-center gap-1 py-3 text-sm text-gray-500
                             hover:text-gray-700 border-t border-gray-100 transition-colors"
                >
                  查看{activeSheet.label}全部 <ChevronRight size={14} />
                </button>
              )}

              {/* Safe area */}
              <div className="h-6" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
