import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
}

const TOP_CATEGORIES = [
  {
    id: 'life',
    label: '生活服务',
    emoji: '🏠',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    desc: '搬家·保洁·接送·装修',
    to: '/search',
  },
  {
    id: 'realestate',
    label: '房产服务',
    emoji: '🏢',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    desc: '地产经纪·房产出售·出租',
    to: '/realestate',
  },
  {
    id: 'auto',
    label: '汽车服务',
    emoji: '🚗',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    desc: '维修·轮胎·道路救援',
    to: null,
  },
  {
    id: 'business',
    label: '商业服务',
    emoji: '🏭',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    desc: '仓储·物流·建筑工程',
    to: null,
  },
  {
    id: 'pro',
    label: '专业服务',
    emoji: '⚖️',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    desc: '法律·税务·保险',
    to: null,
  },
  {
    id: 'study',
    label: '留学移民',
    emoji: '🎓',
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    desc: '留学·签证·培训',
    to: null,
  },
  {
    id: 'secondhand',
    label: '二手交易',
    emoji: '♻️',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    desc: '家具·家电·汽车摩托',
    to: '/secondhand',
  },
  {
    id: 'plaza',
    label: '大多广场',
    emoji: '🎪',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    desc: '同城活动·集市·公益',
    to: '/events',
  },
  {
    id: 'community',
    label: '多村论坛',
    emoji: '💬',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    desc: '社区讨论·经验分享',
    to: '/community',
  },
]

export default function CategoryButtons() {
  const navigate = useNavigate()

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-3 gap-3"
    >
      {TOP_CATEGORIES.map((cat) => {
        const comingSoon = cat.to === null
        return (
          <motion.button
            key={cat.id}
            variants={itemVariants}
            whileTap={comingSoon ? undefined : { scale: 0.93 }}
            onClick={() => { if (cat.to) navigate(cat.to) }}
            disabled={comingSoon}
            className={`
              relative ${cat.bgColor} rounded-2xl p-4 flex flex-col items-center gap-2
              border border-white/60 transition-all duration-200
              ${comingSoon
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:shadow-md active:brightness-95 cursor-pointer'}
            `}
          >
            {comingSoon && (
              <span className="absolute top-2 right-2 text-[9px] font-semibold text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5 leading-tight">
                即将上线
              </span>
            )}
            <span className="text-3xl leading-none">{cat.emoji}</span>
            <span className={`text-sm font-semibold ${comingSoon ? 'text-gray-500' : cat.color}`}>
              {cat.label}
            </span>
            <span className="text-xs text-gray-500 text-center leading-tight line-clamp-2">
              {cat.desc}
            </span>
          </motion.button>
        )
      })}
    </motion.div>
  )
}
