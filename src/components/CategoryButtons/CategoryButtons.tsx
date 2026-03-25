import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CATEGORIES } from '../../data/categories'
import { useAppStore } from '../../store/appStore'
import { Grid2x2 } from 'lucide-react'

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
}

export default function CategoryButtons() {
  const navigate = useNavigate()
  const setSearchFilters = useAppStore((s) => s.setSearchFilters)

  const handleClick = (categoryId: string) => {
    setSearchFilters({ category: categoryId as never, keyword: undefined })
    navigate(`/category/${categoryId}`)
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-3 gap-3"
    >
      {CATEGORIES.slice(0, 5).map((cat) => (
        <motion.button
          key={cat.id}
          variants={itemVariants}
          whileTap={{ scale: 0.93 }}
          onClick={() => handleClick(cat.id)}
          className={`${cat.bgColor} rounded-2xl p-4 flex flex-col items-center gap-2
                       hover:shadow-md transition-all duration-200 active:brightness-95
                       border border-white/60`}
        >
          <img src={cat.image} alt={cat.label} className="w-10 h-10 object-contain" />
          <span className={`text-sm font-semibold ${cat.color}`}>{cat.label}</span>
          <span className="text-xs text-gray-500 text-center leading-tight line-clamp-2">
            {cat.description}
          </span>
        </motion.button>
      ))}

      {/* 更多服务 */}
      <motion.button
        variants={itemVariants}
        whileTap={{ scale: 0.93 }}
        onClick={() => navigate('/search')}
        className="bg-gray-100 rounded-2xl p-4 flex flex-col items-center gap-2
                   hover:shadow-md transition-all duration-200 active:brightness-95
                   border border-white/60"
      >
        <div className="w-10 h-10 flex items-center justify-center">
          <Grid2x2 size={28} className="text-gray-500" />
        </div>
        <span className="text-sm font-semibold text-gray-600">更多服务</span>
        <span className="text-xs text-gray-400 text-center leading-tight">
          查看全部分类
        </span>
      </motion.button>
    </motion.div>
  )
}
