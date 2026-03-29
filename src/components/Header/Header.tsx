// ─── Header ───────────────────────────────────────────────────────────────────
// Sticky navigation bar used on all pages EXCEPT Home.
// Desktop: logo | 浏览服务 | 成为服务商 | 注册 | 登录
// Mobile:  logo | ☰ (浏览服务 + 成为服务商) | 注册 | 登录
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, Menu, X, UserCircle } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

interface HeaderProps {
  /** When false, renders as a static bar (used on Home page over carousel) */
  sticky?: boolean
}

export default function Header({ sticky = true }: HeaderProps) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const close = () => setMenuOpen(false)
  const user = useAuthStore((s) => s.user)

  return (
    <header className={sticky
      ? 'sticky top-0 z-40 bg-white border-b border-gray-200'
      : 'w-full bg-white border-b border-gray-200 relative'
    }>
      <div className="px-4 md:px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" onClick={close} className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
            T
          </div>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-1">

          {/* Desktop-only links */}
          <div className="hidden md:flex items-center gap-1">
            <button className="flex items-center gap-1 text-sm text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
              浏览服务 <ChevronDown size={14} />
            </button>
            <button
              onClick={() => navigate('/post')}
              className="text-sm text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              成为服务商
            </button>
          </div>

          {/* Mobile hamburger (浏览服务 + 成为服务商) */}
          <button
            className="md:hidden text-gray-500 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Auth buttons */}
          {user ? (
            <button
              onClick={() => { navigate('/profile'); close() }}
              className="flex items-center gap-1.5 text-xs md:text-sm text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              <UserCircle size={18} />
              我的
            </button>
          ) : (
            <>
              <button
                onClick={() => { navigate('/register'); close() }}
                className="text-xs md:text-sm bg-primary-600 text-white px-3 md:px-4 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                注册
              </button>
              <button
                onClick={() => { navigate('/login'); close() }}
                className="text-xs md:text-sm text-gray-600 px-2 md:px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                登录
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden absolute top-14 left-0 right-0 bg-white border-b border-gray-200 shadow-md z-50 flex flex-col px-4 py-2">
          <button className="flex items-center gap-1 text-sm text-gray-600 px-3 py-3 rounded-lg hover:bg-gray-100 transition-colors text-left">
            浏览服务 <ChevronDown size={14} />
          </button>
          <button
            onClick={() => { navigate('/post'); close() }}
            className="text-sm text-gray-600 px-3 py-3 rounded-lg hover:bg-gray-100 transition-colors text-left"
          >
            成为服务商
          </button>
        </div>
      )}
    </header>
  )
}
