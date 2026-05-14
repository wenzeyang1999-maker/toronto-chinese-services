import { Home, Search, Plus, MessageSquare, User } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const user = useAuthStore((s) => s.user)
  const [unread, setUnread] = useState(0)

  const hidden =
    /^\/(login|register|forgot-password|reset-password)$/.test(pathname) ||
    pathname.endsWith('/post') ||
    pathname === '/post' ||
    pathname.startsWith('/conversation/') ||
    pathname.startsWith('/admin')

  const fetchUnread = useCallback(async () => {
    if (!user) { setUnread(0); return }
    const { data } = await supabase
      .from('conversations')
      .select('client_unread, provider_unread, client_id')
      .or(`client_id.eq.${user.id},provider_id.eq.${user.id}`)
    if (!data) return
    setUnread(data.reduce((sum, r) =>
      sum + ((r.client_id === user.id ? r.client_unread : r.provider_unread) ?? 0), 0))
  }, [user])

  useEffect(() => { fetchUnread() }, [pathname, fetchUnread])

  useEffect(() => {
    if (!user) return
    const ch = supabase.channel('bottomnav-unread')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, fetchUnread)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user, fetchUnread])

  if (hidden) return null

  const onMessages = pathname === '/profile' && search.includes('messages')
  const onProfile  = pathname === '/profile' && !onMessages

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-white border-t border-gray-100 shadow-[0_-1px_10px_rgba(0,0,0,0.07)]">
      <div className="flex items-end justify-around px-1 h-16 pb-1">

        <NavTab
          icon={<Home size={22} />}
          label="首页"
          active={pathname === '/'}
          onClick={() => navigate('/')}
        />

        <NavTab
          icon={<Search size={22} />}
          label="搜索"
          active={pathname.startsWith('/search')}
          onClick={() => navigate('/search')}
        />

        {/* Center FAB */}
        <button
          onClick={() => navigate(user ? '/post' : '/login')}
          className="flex flex-col items-center -mt-5 gap-0.5"
          aria-label="发布服务"
        >
          <div className="w-14 h-14 bg-primary-600 rounded-full flex items-center justify-center
                          shadow-lg shadow-primary-200 active:scale-95 transition-transform">
            <Plus size={28} className="text-white stroke-[2.5]" />
          </div>
          <span className="text-[10px] text-gray-400">发布</span>
        </button>

        <NavTab
          icon={
            <div className="relative">
              <MessageSquare size={22} />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[16px] h-[15px] bg-red-500 rounded-full
                                 text-white text-[9px] font-bold flex items-center justify-center px-[3px]">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>
          }
          label="消息"
          active={onMessages}
          onClick={() => navigate(user ? '/profile?section=messages' : '/login')}
        />

        <NavTab
          icon={<User size={22} />}
          label="我的"
          active={onProfile}
          onClick={() => navigate(user ? '/profile' : '/login')}
        />
      </div>
    </nav>
  )
}

function NavTab({ icon, label, active, onClick }: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 py-1 px-3 min-w-[52px] transition-colors
        ${active ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
    >
      <span className={active ? '[&_svg]:stroke-[2.5]' : '[&_svg]:stroke-[1.8]'}>{icon}</span>
      <span className={`text-[10px] font-medium ${active ? 'text-primary-600' : 'text-gray-400'}`}>
        {label}
      </span>
    </button>
  )
}
