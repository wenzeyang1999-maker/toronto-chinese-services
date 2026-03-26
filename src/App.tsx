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
import { Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import LoadingScreen from './components/LoadingScreen/LoadingScreen'
import Home from './pages/Home/Home'
import Category from './pages/Category/Category'
import Search from './pages/Search/Search'
import ServiceDetail from './pages/ServiceDetail/ServiceDetail'
import PostService from './pages/PostService/PostService'
import Register from './pages/Auth/Register'
import Login from './pages/Auth/Login'
import { useAppStore } from './store/appStore'

export default function App() {
  const isLoadingDone = useAppStore((s) => s.isLoadingDone)

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
        </Routes>
      )}
    </>
  )
}
