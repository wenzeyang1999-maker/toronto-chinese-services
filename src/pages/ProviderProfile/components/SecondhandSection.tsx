import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import type { SecondhandItem } from '../../Secondhand/types'
import { SECONDHAND_CATEGORY_CONFIG, ITEM_CONDITION_CONFIG, getPriceLabel } from '../../Secondhand/types'
import ImgFallback from '../../../components/ImgFallback/ImgFallback'

interface Props {
  items: SecondhandItem[]
}

export default function SecondhandSection({ items }: Props) {
  const navigate = useNavigate()

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 mb-3 px-1">
        发布的闲置（{items.length}）
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item, i) => (
          <motion.div key={item.id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => navigate(`/secondhand/${item.id}`)}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
                       cursor-pointer hover:border-primary-200 hover:shadow-md transition-all"
          >
            <div className="aspect-square bg-gray-100 overflow-hidden">
              {item.images.length > 0
                ? <ImgFallback
                    src={item.images[0]}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    fallback={<div className="w-full h-full flex items-center justify-center text-3xl">{SECONDHAND_CATEGORY_CONFIG[item.category].emoji}</div>}
                  />
                : <div className="w-full h-full flex items-center justify-center text-3xl">
                    {SECONDHAND_CATEGORY_CONFIG[item.category].emoji}
                  </div>
              }
            </div>
            <div className="p-3">
              <p className="text-sm font-bold text-primary-600 mb-0.5">{getPriceLabel(item)}</p>
              <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{item.title}</p>
              <span className={`inline-block mt-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ITEM_CONDITION_CONFIG[item.condition].color}`}>
                {ITEM_CONDITION_CONFIG[item.condition].label}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
