// ─── Header ───────────────────────────────────────────────────────────────────
// Sticky navigation bar used on all pages EXCEPT Home.
// Desktop: logo | 浏览服务▼ (dropdown) | 成为服务商 | 注册 | 登录
// Mobile:  logo | ☰ (category grid + 成为服务商) | 注册 | 登录
import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, Menu, X, UserCircle, Grid2x2, Search } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { CATEGORIES } from '../../data/categories'

interface HeaderProps {
  /** When false, renders as a static bar (used on Home page over carousel) */
  sticky?: boolean
}

export default function Header({ sticky = true }: HeaderProps) {
  const navigate        = useNavigate()
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [browseOpen, setBrowseOpen] = useState(false)
  const browseRef = useRef<HTMLDivElement>(null)
  const close = () => setMenuOpen(false)
  const user  = useAuthStore((s) => s.user)

  // Close dropdown when clicking outside
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (browseRef.current && !browseRef.current.contains(e.target as Node)) {
        setBrowseOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function goCategory(id: string) {
    navigate(`/category/${id}`)
    setBrowseOpen(false)
    close()
  }

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

          {/* Desktop: 浏览服务 dropdown */}
          <div className="hidden md:block relative" ref={browseRef}>
            <button
              onClick={() => setBrowseOpen((v) => !v)}
              className="flex items-center gap-1 text-sm text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              浏览服务
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${browseOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {browseOpen && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => goCategory(cat.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                  >
                    <span className="text-base">{cat.emoji}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    onClick={() => { navigate('/search'); setBrowseOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary-600 font-medium hover:bg-primary-50 transition-colors text-left"
                  >
                    <Grid2x2 size={15} />
                    <span>更多服务</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Desktop: 成为服务商 */}
          <button
            onClick={() => navigate('/post')}
            className="hidden md:block text-sm text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            成为服务商
          </button>

          {/* Global search */}
          <button
            onClick={() => navigate('/search-all')}
            className="text-gray-500 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="全局搜索"
          >
            <Search size={18} />
          </button>

          {/* Mobile hamburger */}
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

      {/* Mobile dropdown: category grid + 成为服务商 */}
      {menuOpen && (
        <div className="md:hidden absolute top-14 left-0 right-0 bg-white border-b border-gray-200 shadow-md z-50 px-4 pt-3 pb-2">
          <p className="text-xs font-medium text-gray-400 mb-2 px-1">热门服务</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => goCategory(cat.id)}
                className={`${cat.bgColor} rounded-xl py-2.5 flex flex-col items-center gap-1`}
              >
                <span className="text-lg">{cat.emoji}</span>
                <span className={`text-xs font-medium ${cat.color} leading-none`}>{cat.label}</span>
              </button>
            ))}
            <button
              onClick={() => { navigate('/search'); close() }}
              className="bg-gray-100 rounded-xl py-2.5 flex flex-col items-center gap-1"
            >
              <Grid2x2 size={18} className="text-gray-500" />
              <span className="text-xs font-medium text-gray-500 leading-none">更多</span>
            </button>
          </div>
          <div className="border-t border-gray-100 pt-1 pb-1">
            <button
              onClick={() => { navigate('/post'); close() }}
              className="w-full text-sm text-gray-600 px-3 py-3 rounded-lg hover:bg-gray-100 transition-colors text-left"
            >
              成为服务商
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
