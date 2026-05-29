import AiChatWidget from '../AiChatWidget/AiChatWidget'
import MessagesButton from '../MessagesButton/MessagesButton'
import PostServiceFAB from '../PostServiceFAB/PostServiceFAB'
import { useAuthStore } from '../../store/authStore'
import { PlusCircle } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function FABGroup() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const hideMobileFAB =
    /^\/(login|register|forgot-password|reset-password|map)$/.test(pathname) ||
    pathname.endsWith('/post') ||
    pathname === '/post' ||
    pathname.startsWith('/conversation/') ||
    pathname.startsWith('/admin')

  return (
    <>
      {/* Mobile-only: 发布需求 FAB (above bottom nav) */}
      {!hideMobileFAB && <div className="md:hidden fixed bottom-20 right-4 z-50">
        <button
          onClick={() => user ? navigate('/requests/post') : navigate('/login', { state: { from: '/requests/post' } })}
          className="flex items-center gap-2 bg-orange-500 text-white rounded-full shadow-lg
                     px-4 py-3 active:scale-95 transition-all duration-200 text-sm font-semibold whitespace-nowrap"
          style={{ boxShadow: '0 4px 16px rgba(249,115,22,0.4)' }}
        >
          <PlusCircle size={18} strokeWidth={2.2} />
          发布需求
        </button>
      </div>}

      {/* Desktop: full FAB stack */}
      {!hideMobileFAB && <div className="hidden md:flex fixed bottom-6 right-5 lg:bottom-6 lg:right-16 z-50 flex-col items-end gap-3">
        <PostServiceFAB grouped />
        <button
          onClick={() => user ? navigate('/requests/post') : navigate('/login', { state: { from: '/requests/post' } })}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600
                     text-white rounded-full shadow-lg px-4 py-3
                     active:scale-95 transition-all duration-200 text-sm font-semibold whitespace-nowrap"
        >
          <PlusCircle size={18} strokeWidth={2.2} />
          发布需求
        </button>
        {user && <MessagesButton grouped />}
        <AiChatWidget grouped />
      </div>}
    </>
  )
}
