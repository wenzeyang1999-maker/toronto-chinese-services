// ─── App Router ───────────────────────────────────────────────────────────────
// Defines all client-side routes. Shows LoadingScreen on first load,
// then reveals the correct page once loading is done.
//
// Routes:
//   /                → Home page
//   /category/:id   → Services filtered by category
//   /search          → Search results with filters
//   /service/:id    → Service detail view
//   /post           → Post a new service form
//   /register       → User registration page
//   /login          → User login page
//   /profile        → User profile page
import { useCallback, useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { MessageSquare } from 'lucide-react'
import LoadingScreen from './components/LoadingScreen/LoadingScreen'
import Home from './pages/Home/Home'
import Category from './pages/Category/Category'
import Search from './pages/Search/Search'
import ServiceDetail from './pages/ServiceDetail/ServiceDetail'
import PostService from './pages/PostService/PostService'
import Register from './pages/Auth/Register'
import Login from './pages/Auth/Login'
import ForgotPassword from './pages/Auth/ForgotPassword'
import Profile from './pages/Profile/Profile'
import ConversationPage from './pages/Conversation/ConversationPage'
import ResetPassword from './pages/Auth/ResetPassword'
import ProviderProfile from './pages/ProviderProfile/ProviderProfile'
import AiChatWidget from './components/AiChatWidget/AiChatWidget'
import { useAppStore } from './store/appStore'
import { useAuthStore } from './store/authStore'
import { supabase } from './lib/supabase'

export default function App() {
  const isLoadingDone = useAppStore((s) => s.isLoadingDone)
  const setLoadingDone = useAppStore((s) => s.setLoadingDone)
  const fetchServices = useAppStore((s) => s.fetchServices)
  const setUser = useAuthStore((s) => s.setUser)

  // Keep auth state in sync + fetch services on mount.
  // Loading screen is dismissed only after BOTH the minimum display time (2.8s)
  // AND the initial data fetch have completed.
  useEffect(() => {
    let timerDone = false
    let fetchDone = false
    const tryFinish = () => { if (timerDone && fetchDone) setLoadingDone() }

    fetchServices().then(() => { fetchDone = true; tryFinish() }).catch(() => { fetchDone = true; tryFinish() })
    setTimeout(() => { timerDone = true; tryFinish() }, 2800)

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [setUser, fetchServices, setLoadingDone])

  return (
    <>
      {/* Loading splash — fades out when done */}
      <AnimatePresence>
        {!isLoadingDone && <LoadingScreen key="loading" />}
      </AnimatePresence>

      {isLoadingDone && (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/category/:id" element={<Category />} />
          <Route path="/search" element={<Search />} />
          <Route path="/service/:id" element={<ServiceDetail />} />
          <Route path="/post" element={<PostService />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/conversation/:id" element={<ConversationPage />} />
          <Route path="/provider/:id" element={<ProviderProfile />} />
        </Routes>
      )}

      {/* Global AI chat widget — always visible after loading */}
      {isLoadingDone && <AiChatWidget />}
      {isLoadingDone && <MessagesButton />}
    </>
  )
}

// ── Floating messages button with unread badge ─────────────────────────────
function MessagesButton() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const location = useLocation()
  const [unread, setUnread] = useState(0)

  const fetchUnread = useCallback(async () => {
    if (!user) { setUnread(0); return }
    const { data } = await supabase
      .from('conversations')
      .select('client_unread, provider_unread, client_id')
      .or(`client_id.eq.${user.id},provider_id.eq.${user.id}`)
    if (!data) return
    const total = data.reduce((sum, row) => {
      const mine = row.client_id === user.id ? row.client_unread : row.provider_unread
      return sum + (mine ?? 0)
    }, 0)
    setUnread(total)
  }, [user])

  // Refetch on every route change (e.g. after leaving a conversation the count is fresh)
  useEffect(() => {
    fetchUnread()
  }, [location.pathname, fetchUnread])

  // Realtime subscription — also updates when another device/tab changes the count
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('global-unread')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, fetchUnread)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, fetchUnread])

  if (!user) return null

  return (
    <div className="fixed bottom-40 right-5 lg:bottom-20 lg:right-16 z-50">
      <button
        onClick={() => navigate('/profile?section=messages')}
        className="relative flex items-center gap-2 bg-white shadow-lg border border-gray-200
                   text-primary-600 rounded-full px-4 py-3
                   hover:bg-gray-50 active:scale-95 transition-all"
        aria-label="消息"
      >
        <MessageSquare size={20} />
        <span className="text-sm font-semibold whitespace-nowrap">消息</span>
        {unread > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>
    </div>
  )
}
