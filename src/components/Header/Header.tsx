// ─── Header ────────────────────────────────────────────────────────────────────
// V5.2 unified nav bar + P2 contextual search bar
//
// Desktop (≥ lg): single row
//   Logo | 生活服务 求职招聘 二手交易 房产租售 大多广场 | [search input] | 🔔 [auth]
//
// Mobile (< lg): three rows
//   Row 1: Logo | <spacer> | 🔔 [auth]
//   Row 2: scrollable section tabs
//   Row 3: contextual search bar (only when on a section page)
import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, UserCircle } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import HuaLinLogo from '../Logo/HuaLinLogo'
import AdminNotificationsBell from '../AdminNotifications/AdminNotificationsBell'

// ── Section definitions ───────────────────────────────────────────────────────
const NAV_SECTIONS = [
  { id: 'services',   label: '生活服务', href: '/' },
  { id: 'jobs',       label: '求职招聘', href: '/jobs' },
  { id: 'secondhand', label: '二手交易', href: '/secondhand' },
  { id: 'realestate', label: '房产租售', href: '/realestate' },
  { id: 'plaza',      label: '大多广场', href: '/plaza' },
] as const

type SectionId = typeof NAV_SECTIONS[number]['id']

const PLACEHOLDER: Record<SectionId, string> = {
  services:   '在 7 大生活服务中搜索师傅…',
  jobs:       '在招聘信息中搜索…',
  secondhand: '在二手物品中搜索…',
  realestate: '在当前房源中搜索…',
  plaza:      '在同城集市 / 活动中搜索…',
}

// Pages that render their own search bar — Header row 3 would be redundant there
const PAGES_WITH_OWN_SEARCH = new Set(['/jobs', '/secondhand', '/realestate', '/search'])

function getActiveSection(pathname: string): SectionId | null {
  if (pathname.startsWith('/jobs'))        return 'jobs'
  if (pathname.startsWith('/secondhand'))  return 'secondhand'
  if (pathname.startsWith('/realestate'))  return 'realestate'
  if (
    pathname.startsWith('/plaza') ||
    pathname.startsWith('/events') ||
    pathname.startsWith('/community')
  ) return 'plaza'
  if (
    pathname === '/' ||
    pathname.startsWith('/category') ||
    pathname.startsWith('/service') ||
    pathname.startsWith('/search') ||
    pathname.startsWith('/post') ||
    pathname.startsWith('/map')
  ) return 'services'
  return null
}

function buildSearchUrl(query: string, active: SectionId | null, global: boolean): string {
  const q = encodeURIComponent(query.trim())
  if (global || !active)        return `/search?q=${q}&global=1`
  if (active === 'jobs')        return `/jobs?keyword=${q}`
  if (active === 'secondhand')  return `/secondhand?keyword=${q}`
  if (active === 'realestate')  return `/realestate?keyword=${q}`
  if (active === 'services')    return `/search?q=${q}`
  return `/search?q=${q}&global=1`
}

interface HeaderProps {
  sticky?: boolean
}

export default function Header({ sticky = true }: HeaderProps) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const user      = useAuthStore((s) => s.user)
  const active    = getActiveSection(location.pathname)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [searchQuery,  setSearchQuery]  = useState('')
  const [globalSearch, setGlobalSearch] = useState(false)

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return
    navigate(buildSearchUrl(searchQuery, active, globalSearch))
    setSearchQuery('')
  }, [searchQuery, active, globalSearch, navigate])

  const placeholder = active ? PLACEHOLDER[active] : '搜索…'

  return (
    <header className={sticky
      ? 'sticky top-0 z-40 bg-white border-b border-gray-200 pt-safe'
      : 'w-full bg-white border-b border-gray-200 relative pt-safe'
    }>

      {/* ── Main row ─────────────────────────────────────────────────────────── */}
      <div className="px-3 md:px-6 h-14 flex items-center gap-2">

        {/* Logo */}
        <Link to="/" className="flex items-center flex-shrink-0 mr-2 lg:mr-4">
          <HuaLinLogo variant="full" theme="light" size={32} />
        </Link>

        {/* Desktop section nav (lg+) */}
        <nav className="hidden lg:flex items-center gap-0.5 flex-shrink-0">
          {NAV_SECTIONS.map((sec) => {
            const isActive = active === sec.id
            return (
              <button
                key={sec.id}
                onClick={() => navigate(sec.href)}
                className={`relative px-3 py-2 text-sm rounded-lg transition-colors whitespace-nowrap
                  ${isActive ? 'text-primary-600 font-bold' : 'font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
              >
                {sec.label}
                {isActive && (
                  <motion.div
                    layoutId="nav-underline"
                    className="absolute bottom-0.5 left-2 right-2 h-0.5 bg-primary-600 rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            )
          })}
        </nav>

        {/* Desktop contextual search (lg+) */}
        <div className="hidden lg:flex items-center flex-1 mx-3 min-w-0">
          <div className="flex items-center w-full bg-gray-100 rounded-xl px-3 py-1.5 gap-2">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none min-w-0"
            />
            <label className="flex items-center gap-1 flex-shrink-0 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.checked)}
                className="w-3 h-3 rounded"
              />
              <span className="text-[11px] text-gray-400 whitespace-nowrap">全站</span>
            </label>
          </div>
        </div>

        {/* Mobile spacer */}
        <div className="flex-1 lg:hidden" />

        {/* Right utilities */}
        <div className="flex items-center gap-0.5">

          {/* Mobile search icon */}
          <button
            onClick={() => navigate('/search?global=1')}
            className="lg:hidden p-2 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="全局搜索"
          >
            <Search size={18} />
          </button>

          {/* Admin notification bell */}
          {user && <AdminNotificationsBell compact />}

          {/* Identity flip */}
          {user ? (
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-1.5 text-xs md:text-sm text-gray-700
                         px-2.5 py-2 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              <UserCircle size={18} />
              <span className="hidden sm:inline">我的</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/register')}
                className="text-xs md:text-sm bg-primary-600 text-white px-3 py-2 rounded-lg
                           font-medium hover:bg-primary-700 transition-colors"
              >
                注册
              </button>
              <button
                onClick={() => navigate('/login')}
                className="text-xs md:text-sm text-gray-600 px-2 py-2 rounded-lg
                           hover:bg-gray-100 transition-colors"
              >
                登录
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Mobile section tabs (< lg) ────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="lg:hidden flex overflow-x-auto scrollbar-hide border-t border-gray-50 bg-white"
        style={{ scrollbarWidth: 'none' }}
      >
        {NAV_SECTIONS.map((sec) => {
          const isActive = active === sec.id
          return (
            <button
              key={sec.id}
              onClick={() => navigate(sec.href)}
              className={`relative flex-shrink-0 px-4 py-2 text-xs transition-colors whitespace-nowrap
                ${isActive ? 'text-primary-600 font-bold' : 'font-semibold text-gray-500 hover:text-gray-700'}`}
            >
              {sec.label}
              {isActive && (
                <motion.div
                  layoutId="nav-underline-mobile"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary-600 rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Mobile contextual search (< lg, section pages only) ──────────────── */}
      {active !== null && !PAGES_WITH_OWN_SEARCH.has(location.pathname) && (
        <div className="lg:hidden px-3 py-2 bg-white border-t border-gray-50">
          <div className="flex items-center bg-gray-100 rounded-xl px-3 py-2 gap-2">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
            />
            <label className="flex items-center gap-1 flex-shrink-0 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.checked)}
                className="w-3 h-3 rounded"
              />
              <span className="text-[11px] text-gray-400 whitespace-nowrap">全站</span>
            </label>
          </div>
        </div>
      )}
    </header>
  )
}
