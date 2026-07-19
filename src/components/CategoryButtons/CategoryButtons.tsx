import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  type LucideIcon,
  Truck, Sparkles, Car, Leaf, Hammer, Wrench, LifeBuoy, Cog,
} from 'lucide-react'

// ── 热门服务：生活服务 8 大类目直达（点击 → 搜索该类目）───────────────────────
// 固定 8 类，4×2 两行铺满，不留空格。
interface Category {
  label: string
  q: string           // search keyword
  icon: LucideIcon
  color: string
  bgColor: string
}

const CATEGORIES: Category[] = [
  { label: '搬运',     q: '搬运',     icon: Truck,    color: 'text-blue-600',   bgColor: 'bg-blue-50' },
  { label: '保洁',     q: '保洁',     icon: Sparkles, color: 'text-cyan-600',   bgColor: 'bg-cyan-50' },
  { label: '接送',     q: '接送',     icon: Car,      color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  { label: '园艺除雪', q: '园艺',     icon: Leaf,     color: 'text-green-600',  bgColor: 'bg-green-50' },
  { label: '装修',     q: '装修',     icon: Hammer,   color: 'text-amber-600',  bgColor: 'bg-amber-50' },
  { label: 'Handyman', q: 'Handyman', icon: Wrench,   color: 'text-violet-600', bgColor: 'bg-violet-50' },
  { label: '道路救援', q: '道路救援', icon: LifeBuoy, color: 'text-rose-600',   bgColor: 'bg-rose-50' },
  { label: '汽车维修', q: '汽车维修', icon: Cog,      color: 'text-slate-600',  bgColor: 'bg-slate-100' },
]

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
}

export default function CategoryButtons() {
  const navigate = useNavigate()

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-4 gap-2"
    >
      {CATEGORIES.map((cat) => (
        <motion.button
          key={cat.label}
          variants={itemVariants}
          whileTap={{ scale: 0.93 }}
          onClick={() => navigate(`/search?q=${encodeURIComponent(cat.q)}`)}
          className={`relative ${cat.bgColor} rounded-xl py-2.5 px-1 flex flex-col items-center gap-1.5
                      border border-white/60 hover:shadow-md active:brightness-95 transition-all`}
        >
          <cat.icon size={20} strokeWidth={1.6} className={cat.color} />
          <span className={`text-[11px] font-semibold whitespace-nowrap ${cat.color}`}>{cat.label}</span>
        </motion.button>
      ))}
    </motion.div>
  )
}
