import { motion } from 'framer-motion'
import { Clock, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { BrowseEntry } from '../types'

interface Props {
  items:   BrowseEntry[]
  onClear: () => void
}

export default function BrowseSection({ items, onClear }: Props) {
  const navigate = useNavigate()

  return (
    <motion.div
      key="browse"
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}
      className="flex-1 px-4 py-6 max-w-md lg:max-w-none mx-auto w-full"
    >
      {items.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm py-16 px-8 text-center">
          <span className="text-5xl block mb-4 select-none">🕐</span>
          <p className="text-base font-semibold text-gray-700 mb-1.5">暂无浏览记录</p>
          <p className="text-sm text-gray-400 leading-relaxed mb-5">浏览过的服务会自动保存在这里<br />方便你随时回看</p>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-2xl hover:bg-primary-700 transition-colors"
          >
            去发现服务
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">最近浏览</span>
            <button onClick={onClear} className="text-xs text-gray-400 hover:text-red-500">清空</button>
          </div>
          <div className="divide-y divide-gray-50">
            {items.map(item => (
              <button key={item.id} onClick={() => navigate(`/service/${item.id}`)}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 text-left">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{item.title}</p>
                  <p className="text-xs text-gray-400">{item.area ?? item.category} · {new Date(item.ts).toLocaleDateString('zh-CN')}</p>
                </div>
                <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
