// ─── HeroBanner ───────────────────────────────────────────────────────────────
// Top navigation bar — sticky on all pages that include it.
// Contains: logo (left) | nav links + sign up / login buttons (right).
//
// NOTE: This component is nav only. The carousel and search bar live in
// HeroCarousel.tsx and are assembled in Home.tsx.
import { useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

export default function HeroBanner() {
  const navigate = useNavigate()

  return (
    <div className="w-full bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between">
      {/* Logo */}
      <button onClick={() => navigate('/')} className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
          T
        </div>
      </button>

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
  )
}
