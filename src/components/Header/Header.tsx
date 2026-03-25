// ─── Header ───────────────────────────────────────────────────────────────────
// Sticky navigation bar used on all pages EXCEPT Home.
// (Home uses HeroBanner which has its own nav row.)
//
// Contains: logo (left) | location indicator + post-service button (right)
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

export default function Header() {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="w-full px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
            T
          </div>
        </Link>

        {/* Right nav */}
        <div className="flex items-center gap-1">
          <button className="flex items-center gap-1 text-sm text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
            浏览服务 <ChevronDown size={14} />
          </button>
          <button
            onClick={() => navigate('/post')}
            className="text-sm text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            成为服务商
          </button>
          <button
            onClick={() => navigate('/register')}
            className="text-sm bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors ml-1"
          >
            注册
          </button>
          <button className="text-sm text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
            登录
          </button>
        </div>
      </div>
    </header>
  )
}
