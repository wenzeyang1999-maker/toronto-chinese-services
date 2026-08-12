import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  type LucideIcon,
  Truck, Sparkles, Car, Leaf, Hammer, Wrench, LifeBuoy, Cog,
  Tv, Droplets, Plug, Paintbrush, Layers, Baby, PawPrint, Sofa,
} from 'lucide-react'

// ── 热门服务：生活服务类目直达（点击 → 搜索该类目）─────────────────────────────
// 默认展示 8 大类（4×2）；点击「更多服务」在原框内展开第二排 8 类，不跳转。
interface Category {
  label: string
  q: string           // search keyword
  icon: LucideIcon
  img?: string        // 吉祥物图路径（有则替代 icon），如 '/mascot/cat-moving.png'
  color: string
  bgColor: string
}

const CATEGORIES: Category[] = [
  { label: '搬运',     q: '搬运',     icon: Truck,    img: '/mascot/cat-moving.png',     color: 'text-blue-600',   bgColor: 'bg-blue-50' },
  { label: '保洁',     q: '保洁',     icon: Sparkles, img: '/mascot/cat-cleaning.png',   color: 'text-cyan-600',   bgColor: 'bg-cyan-50' },
  { label: '接送',     q: '接送',     icon: Car,      img: '/mascot/cat-ride.png',       color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  { label: '园艺除雪', q: '园艺',     icon: Leaf,     img: '/mascot/cat-garden.png',     color: 'text-green-600',  bgColor: 'bg-green-50' },
  { label: '装修',     q: '装修',     icon: Hammer,   img: '/mascot/cat-renovation.png', color: 'text-amber-600',  bgColor: 'bg-amber-50' },
  { label: 'Handyman', q: 'Handyman', icon: Wrench,   img: '/mascot/cat-handyman.png',   color: 'text-violet-600', bgColor: 'bg-violet-50' },
  { label: '道路救援', q: '道路救援', icon: LifeBuoy, img: '/mascot/cat-roadside.png',   color: 'text-rose-600',   bgColor: 'bg-rose-50' },
  { label: '汽车维修', q: '汽车维修', icon: Cog,      img: '/mascot/cat-auto.png',       color: 'text-slate-600',  bgColor: 'bg-slate-100' },
]

// 「更多服务」展开后追加的 8 类。
const MORE_CATEGORIES: Category[] = [
  { label: 'Staging',  q: 'Staging',  icon: Sofa,      color: 'text-red-600',     bgColor: 'bg-red-50' },
  { label: '管道疏通', q: '疏通',     icon: Droplets,  color: 'text-teal-600',    bgColor: 'bg-teal-50' },
  { label: '水电',     q: '水电',     icon: Plug,      color: 'text-yellow-600',  bgColor: 'bg-yellow-50' },
  { label: '油漆粉刷', q: '油漆',     icon: Paintbrush, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  { label: '地板安装', q: '地板',     icon: Layers,    color: 'text-lime-600',    bgColor: 'bg-lime-50' },
  { label: '月嫂保姆', q: '月嫂',     icon: Baby,      color: 'text-pink-600',    bgColor: 'bg-pink-50' },
  { label: '宠物服务', q: '宠物',     icon: PawPrint,  color: 'text-fuchsia-600', bgColor: 'bg-fuchsia-50' },
  { label: '家电维修', q: '家电维修', icon: Tv,        color: 'text-sky-600',     bgColor: 'bg-sky-50' },
]

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
}

function Tile({ cat, onClick }: { cat: Category; onClick: () => void }) {
  return (
    <motion.button
      variants={itemVariants}
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className={`relative ${cat.bgColor} rounded-xl py-1.5 pl-1 pr-2 flex items-center justify-start gap-0.5
                  border border-white/60 hover:shadow-md active:brightness-95 transition-all`}
    >
      {cat.img
        ? <img src={cat.img} alt="" className="w-16 h-16 sm:w-20 sm:h-20 object-contain flex-shrink-0 -my-2" draggable={false} />
        : <cat.icon size={22} strokeWidth={1.6} className={`${cat.color} flex-shrink-0 ml-1`} />}
      <span className={`text-[13px] sm:text-sm font-semibold whitespace-nowrap ${cat.color}`}>{cat.label}</span>
    </motion.button>
  )
}

export default function CategoryButtons({ expanded = false }: { expanded?: boolean }) {
  const navigate = useNavigate()
  const go = (q: string) => navigate(`/search?q=${encodeURIComponent(q)}`)

  return (
    <div>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
      >
        {CATEGORIES.map((cat) => (
          <Tile key={cat.label} cat={cat} onClick={() => go(cat.q)} />
        ))}
      </motion.div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2"
            >
              {MORE_CATEGORIES.map((cat) => (
                <Tile key={cat.label} cat={cat} onClick={() => go(cat.q)} />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
