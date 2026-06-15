import { useNavigate } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center gap-6">
      <div className="text-7xl select-none">🗺️</div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">页面不存在</h1>
        <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
          这个页面可能已经被移除，或者链接有误。别担心，回首页一切都在。
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <button
          onClick={() => navigate(-1)}
          className="flex-1 flex items-center justify-center gap-2 border border-gray-200 bg-white
                     text-gray-700 rounded-2xl py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft size={16} />
          返回上一页
        </button>
        <button
          onClick={() => navigate('/')}
          className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700
                     text-white rounded-2xl py-3 text-sm font-semibold transition-colors shadow-sm"
        >
          <Home size={16} />
          回到首页
        </button>
      </div>
    </div>
  )
}
