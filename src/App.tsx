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
import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import type { User } from '@supabase/supabase-js'
import LoadingScreen from './components/LoadingScreen/LoadingScreen'
import Home from './pages/Home/Home'
import AiChatWidget from './components/AiChatWidget/AiChatWidget'
import MessagesButton from './components/MessagesButton/MessagesButton'
import MessageToast from './components/MessageToast/MessageToast'
import InstallPWA from './components/InstallPWA/InstallPWA'

const Category        = lazy(() => import('./pages/Category/Category'))
const Search          = lazy(() => import('./pages/Search/Search'))
const ServiceDetail   = lazy(() => import('./pages/ServiceDetail/ServiceDetail'))
const PostService     = lazy(() => import('./pages/PostService/PostService'))
const Register        = lazy(() => import('./pages/Auth/Register'))
const Login           = lazy(() => import('./pages/Auth/Login'))
const ForgotPassword  = lazy(() => import('./pages/Auth/ForgotPassword'))
const Profile         = lazy(() => import('./pages/Profile/Profile'))
const ConversationPage = lazy(() => import('./pages/Conversation/ConversationPage'))
const ResetPassword   = lazy(() => import('./pages/Auth/ResetPassword'))
const ProviderProfile = lazy(() => import('./pages/ProviderProfile/ProviderProfile'))
const JobList         = lazy(() => import('./pages/Jobs/JobList'))
const JobDetail       = lazy(() => import('./pages/Jobs/JobDetail'))
const PostJob         = lazy(() => import('./pages/Jobs/PostJob'))
const SecondhandList  = lazy(() => import('./pages/Secondhand/SecondhandList'))
const SecondhandDetail = lazy(() => import('./pages/Secondhand/SecondhandDetail'))
const PostListing     = lazy(() => import('./pages/Secondhand/PostListing'))
const RealEstateList  = lazy(() => import('./pages/RealEstate/RealEstateList'))
const RealEstateDetail = lazy(() => import('./pages/RealEstate/RealEstateDetail'))
const PostProperty    = lazy(() => import('./pages/RealEstate/PostProperty'))
const EventList       = lazy(() => import('./pages/Events/EventList'))
const EventDetail     = lazy(() => import('./pages/Events/EventDetail'))
const PostEvent       = lazy(() => import('./pages/Events/PostEvent'))
const AdminPage       = lazy(() => import('./pages/Admin/AdminPage'))
const GlobalSearch    = lazy(() => import('./pages/GlobalSearch/GlobalSearch'))
const CommunityPage   = lazy(() => import('./pages/Community/CommunityPage'))
const CommunityDetail = lazy(() => import('./pages/Community/CommunityDetail'))
const PostCommunity   = lazy(() => import('./pages/Community/PostCommunity'))
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
    let isActive = true
    let timerDone = false
    let fetchDone = false
    const tryFinish = () => {
      if (isActive && timerDone && fetchDone) setLoadingDone()
    }
    const syncSessionUser = async (authUser: User | null) => {
      if (!isActive) return
      if (!authUser) {
        setUser(null)
        return
      }

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .single()

      if (!isActive) return

      if (profile?.role === 'banned') {
        await supabase.auth.signOut()
        setUser(null)
        return
      }

      setUser(authUser)
      supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', authUser.id)
    }

    fetchServices()
      .then(() => { fetchDone = true; tryFinish() })
      .catch(() => { fetchDone = true; tryFinish() })

    const timerId = window.setTimeout(() => {
      timerDone = true
      tryFinish()
    }, 2800)

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      void syncSessionUser(u)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      void syncSessionUser(u)
    })
    return () => {
      isActive = false
      window.clearTimeout(timerId)
      subscription.unsubscribe()
    }
  }, [setUser, fetchServices, setLoadingDone])

  return (
    <>
      {/* Loading splash — fades out when done */}
      <AnimatePresence>
        {!isLoadingDone && <LoadingScreen key="loading" />}
      </AnimatePresence>

      {isLoadingDone && (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">加载中…</div>}>
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
          <Route path="/jobs" element={<JobList />} />
          <Route path="/jobs/post" element={<PostJob />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/secondhand" element={<SecondhandList />} />
          <Route path="/secondhand/post" element={<PostListing />} />
          <Route path="/secondhand/:id" element={<SecondhandDetail />} />
          <Route path="/realestate" element={<RealEstateList />} />
          <Route path="/realestate/post" element={<PostProperty />} />
          <Route path="/realestate/:id" element={<RealEstateDetail />} />
          <Route path="/events" element={<EventList />} />
          <Route path="/events/post" element={<PostEvent />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/search-all" element={<GlobalSearch />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/community/post" element={<PostCommunity />} />
          <Route path="/community/:id" element={<CommunityDetail />} />
        </Routes>
        </Suspense>
      )}

      {/* Global AI chat widget — always visible after loading */}
      {isLoadingDone && <AiChatWidget />}
      {isLoadingDone && <MessagesButton />}
      {isLoadingDone && <MessageToast />}
      {isLoadingDone && <InstallPWA />}
    </>
  )
}
