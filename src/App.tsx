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
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import type { User } from '@supabase/supabase-js'
import LoadingScreen from './components/LoadingScreen/LoadingScreen'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import Home from './pages/Home/Home'
import ToastContainer from './components/Toast/ToastContainer'
import MessageToast from './components/MessageToast/MessageToast'
import NotificationPrompt from './components/NotificationPrompt/NotificationPrompt'
import InstallPWA from './components/InstallPWA/InstallPWA'
import FABGroup from './components/FABGroup/FABGroup'
import AiChatWidget from './components/AiChatWidget/AiChatWidget'
import BottomNav from './components/BottomNav/BottomNav'
import CityGate from './components/GeofenceBanner/CityGate'

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
const CommunityPage   = lazy(() => import('./pages/Community/CommunityPage'))
const CommunityDetail = lazy(() => import('./pages/Community/CommunityDetail'))
const PostCommunity   = lazy(() => import('./pages/Community/PostCommunity'))
const PlazaPage       = lazy(() => import('./pages/Plaza/PlazaPage'))
const RequestDetail   = lazy(() => import('./pages/RequestDetail/RequestDetail'))
const MapPage         = lazy(() => import('./pages/MapPage/MapPage'))
const PrivacyPolicy   = lazy(() => import('./pages/Legal/PrivacyPolicy'))
const TermsOfService  = lazy(() => import('./pages/Legal/TermsOfService'))
const InquiryClaim    = lazy(() => import('./pages/InquiryClaim/InquiryClaim'))
const NotFound        = lazy(() => import('./pages/NotFound/NotFound'))
import { useAppStore } from './store/appStore'
import { useAuthStore } from './store/authStore'
import { useOnlineModeStore } from './store/onlineModeStore'
import { supabase } from './lib/supabase'
import { unsubscribeFromWebPush } from './lib/webPush'
import { useRequestMatchAlerts } from './hooks/useRequestMatchAlerts'
import { useUrgentRequestAlerts } from './hooks/useUrgentRequestAlerts'
import UrgentLeadPopup from './components/UrgentLeadPopup/UrgentLeadPopup'
import { useLeadAlerts } from './hooks/useLeadAlerts'
import { useReadSync } from './lib/useReadSync'
import { useViewportHeight } from './lib/useViewportHeight'

function SearchAllRedirect() {
  const q = new URLSearchParams(window.location.search).get('q') ?? ''
  return <Navigate to={q ? `/search?q=${encodeURIComponent(q)}&global=1` : '/search?global=1'} replace />
}

// Mobile-only floating AI bubble. On desktop the AI 客服 button lives in the
// FABGroup stack (hidden on mobile), so without this the bot vanishes on phones.
// Hidden on the same routes as the bottom nav to avoid clashing with page
// bottom bars; md:hidden so it never doubles up with the desktop FAB.
function MobileAiBubble() {
  const { pathname } = useLocation()
  const hidden =
    /^\/(login|register|forgot-password|reset-password|map)$/.test(pathname) ||
    pathname.endsWith('/post') ||
    pathname === '/post' ||
    pathname.startsWith('/conversation/') ||
    pathname.startsWith('/admin')
  if (hidden) return null
  return (
    <div className="md:hidden">
      <AiChatWidget />
    </div>
  )
}

// App-wide「上线接单」indicator — a faint blue gradient rising from the bottom on
// EVERY screen while the provider is online, so they always know they're live.
// pointer-events-none + fixed → purely cosmetic, never blocks taps or scroll.
function OnlineModeTint() {
  const online = useOnlineModeStore((s) => s.online)
  if (!online) return null
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[45] bg-gradient-to-t
                 from-blue-500/20 via-blue-500/[0.06] to-transparent"
    />
  )
}

export default function App() {
  useRequestMatchAlerts()
  useUrgentRequestAlerts()
  useLeadAlerts()
  useReadSync()
  useViewportHeight()
  const isLoadingDone = useAppStore((s) => s.isLoadingDone)
  const setLoadingDone = useAppStore((s) => s.setLoadingDone)
  const fetchServices = useAppStore((s) => s.fetchServices)
  const fetchServiceRequests = useAppStore((s) => s.fetchServiceRequests)
  const setUser = useAuthStore((s) => s.setUser)

  // Keep auth state in sync + fetch services on mount.
  // Loading screen is dismissed only after BOTH the minimum display time (2.8s)
  // AND the initial data fetch have completed.
  useEffect(() => {
    let isActive = true
    let timerDone = false
    let fetchDone = false
    let authDone = false
    const tryFinish = () => {
      if (isActive && timerDone && fetchDone && authDone) setLoadingDone()
    }
    const syncSessionUser = async (authUser: User | null) => {
      if (!isActive) return
      if (!authUser) {
        const prevUser = useAuthStore.getState().user
        if (prevUser) {
          unsubscribeFromWebPush(prevUser.id).catch(() => {})
        }
        setUser(null)
        useOnlineModeStore.getState().setOnline(false)   // logged out → no tint
        return
      }

      // Set the user immediately from the restored session so the UI doesn't
      // flash a logged-out state while the role/banned check round-trips.
      setUser(authUser)

      const { data: profile } = await supabase
        .from('users')
        .select('role, is_online')
        .eq('id', authUser.id)
        .single()

      if (!isActive) return

      if (profile?.role === 'banned') {
        await supabase.auth.signOut()
        setUser(null)
        useOnlineModeStore.getState().setOnline(false)
        return
      }

      // Reconcile the app-wide「上线接单」tint with the real DB state so a stale
      // localStorage flag can't show blue while actually offline (or vice versa).
      useOnlineModeStore.getState().setOnline(profile?.is_online === true)

      // First-time OAuth users (Google/Apple) won't have a public.users row yet.
      // The email/password flow creates it via a DB trigger; OAuth needs this fallback.
      if (!profile) {
        const meta = authUser.user_metadata ?? {}
        supabase.from('users').insert({
          id:         authUser.id,
          email:      authUser.email ?? '',
          name:       meta.full_name ?? meta.name ?? '华邻用户',
          avatar_url: meta.avatar_url ?? meta.picture ?? null,
        }).then(() => {}, () => {})
      }

      setUser(authUser)
      supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', authUser.id)
    }

    fetchServiceRequests()
    fetchServices()
      .then(() => { fetchDone = true; tryFinish() })
      .catch(() => { fetchDone = true; tryFinish() })

    const timerId = window.setTimeout(() => {
      timerDone = true
      tryFinish()
    }, 2800)

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      // syncSessionUser sets the user synchronously (before its first await), so
      // by here the logged-in/out state is known → let the loading screen finish.
      void syncSessionUser(u)
      authDone = true
      tryFinish()
    }).catch(() => { authDone = true; tryFinish() })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      void syncSessionUser(u)
    })
    return () => {
      isActive = false
      window.clearTimeout(timerId)
      subscription.unsubscribe()
    }
  }, [setUser, fetchServices, fetchServiceRequests, setLoadingDone])

  return (
    <>
      {/* Loading splash — fades out when done */}
      <AnimatePresence>
        {!isLoadingDone && <LoadingScreen key="loading" />}
      </AnimatePresence>

      {isLoadingDone && (
        <ErrorBoundary>
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">加载中…</div>}>
        <div className="pb-16 md:pb-0">
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
          <Route path="/plaza" element={<PlazaPage />} />
          <Route path="/events" element={<EventList />} />
          <Route path="/events/post" element={<PostEvent />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/search-all" element={<SearchAllRedirect />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/community/post" element={<PostCommunity />} />
          <Route path="/community/:id" element={<CommunityDetail />} />
          {/* 旧「发布服务需求」页已合并进「AI帮你找」弹窗，旧链接重定向过去 */}
          <Route path="/requests/post" element={<Navigate to="/?inquiry=1" replace />} />
          <Route path="/requests/:id" element={<RequestDetail />} />
          <Route path="/inquiries/:id/claim" element={<InquiryClaim />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </div>
        </Suspense>
        </ErrorBoundary>
      )}

      {/* App-wide「上线接单」blue tint (cosmetic, non-blocking) */}
      {isLoadingDone && <OnlineModeTint />}

      {/* Desktop FABs + mobile bottom nav */}
      {isLoadingDone && <FABGroup />}
      {isLoadingDone && <MobileAiBubble />}
      {isLoadingDone && <BottomNav />}
      {isLoadingDone && <MessageToast />}
      {isLoadingDone && <NotificationPrompt />}
      {isLoadingDone && <InstallPWA />}
      {isLoadingDone && <CityGate />}
      {isLoadingDone && <UrgentLeadPopup />}
      {/* Provider inquiry alerts removed: it subscribed the provider's browser to
          the whole inquiries table (which carries customer name/phone/wechat),
          a PII-over-realtime risk. Providers are notified via email + the public
          service_requests alert (useRequestMatchAlerts) instead — no PII. */}
      <ToastContainer />
    </>
  )
}
