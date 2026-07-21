import AiChatWidget from '../AiChatWidget/AiChatWidget'
import MessagesButton from '../MessagesButton/MessagesButton'
import { useAuthStore } from '../../store/authStore'
import { Plus, PlusCircle } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function FABGroup() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const hideMobileFAB =
    /^\/(login|register|forgot-password|reset-password)$/.test(pathname) ||
    pathname.endsWith('/post') ||
    pathname === '/post' ||
    pathname.startsWith('/conversation/') ||
    pathname.startsWith('/admin')

  return (
    <>
      {/* Mobile publish is now the BottomNav「+」→ PublishSheet (single entry).
          Only the desktop FAB stack remains here. */}

      {/* Desktop: full FAB stack */}
      {!hideMobileFAB && <div className="hidden md:flex fixed bottom-6 right-5 lg:bottom-6 lg:right-16 z-50 flex-col items-end gap-3">
        <button
          onClick={() => user ? navigate('/post') : navigate('/login', { state: { from: '/post' } })}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700
                     text-white rounded-full px-4 py-3
                     active:scale-95 transition-all duration-200 text-sm font-semibold whitespace-nowrap"
          style={{ boxShadow: '0 8px 28px rgba(37,99,235,0.45), 0 2px 8px rgba(37,99,235,0.25)' }}
        >
          <Plus size={20} strokeWidth={2.5} />
          发布服务
        </button>
        <button
          onClick={() => navigate('/?inquiry=1')}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600
                     text-white rounded-full px-4 py-3
                     active:scale-95 transition-all duration-200 text-sm font-semibold whitespace-nowrap"
          style={{ boxShadow: '0 8px 28px rgba(249,115,22,0.50), 0 2px 8px rgba(249,115,22,0.30)' }}
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
