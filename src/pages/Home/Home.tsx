import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import HeroBanner from '../../components/HeroBanner/HeroBanner'
import HeroCarousel from '../../components/HeroCarousel/HeroCarousel'
import CategoryButtons from '../../components/CategoryButtons/CategoryButtons'
import ServiceCard from '../../components/ServiceCard/ServiceCard'
import SearchBar from '../../components/SearchBar/SearchBar'
import InquiryModal from '../../components/InquiryModal/InquiryModal'
import SectionTabs, { type SectionTab } from '../../components/SectionTabs/SectionTabs'
import { useAppStore } from '../../store/appStore'
import { useGeolocation } from '../../hooks/useGeolocation'
import { ChevronRight, MapPin, Sparkles } from 'lucide-react'
import RecentCategories from '../../components/RecentCategories/RecentCategories'
import RecommendedServices from '../../components/RecommendedServices/RecommendedServices'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function Home() {
  useGeolocation()
  const services     = useAppStore((s) => s.services)
  const setSearchFilters = useAppStore((s) => s.setSearchFilters)
  const userLocation = useAppStore((s) => s.userLocation)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<SectionTab>('services')
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)

  // When clicking "找服务" tab, skip carousel and jump to search bar
  useEffect(() => {
    if (searchParams.get('from') !== 'tabs') return
    const scroll = () => {
      if (!searchRef.current) return
      const top = searchRef.current.getBoundingClientRect().top + window.scrollY - 60
      window.scrollTo({ top, behavior: 'smooth' })
    }
    // Small delay ensures the page has painted before scrolling
    const t = setTimeout(scroll, 50)
    return () => clearTimeout(t)
  }, [searchParams])

  const handleSearch = (kw: string) => {
    if (!kw.trim()) return
    setSearchFilters({ keyword: kw.trim(), category: undefined })
    navigate(`/search?q=${encodeURIComponent(kw.trim())}`)
  }

  const recent = services.filter((s) => s.available).slice(0, 4)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky: banner + section tabs */}
      <div className="sticky top-0 z-40">
        <HeroBanner />
        <div className="bg-white border-b border-gray-100">
          <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto">
            <SectionTabs active={activeTab} onChange={setActiveTab} containerClassName="px-0" />
          </div>
        </div>
      </div>

      {/* Carousel — scrolls normally */}
      <HeroCarousel />

      {/* Search bar — scrolls normally */}
      <div ref={searchRef} className="w-full bg-primary-700 px-6 py-4">
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto">
          <div className="flex items-center gap-1.5 mb-2">
            <MapPin size={12} className="text-blue-200" />
            <span className="text-blue-200 text-xs">
              {userLocation ? '已获取您的位置' : '大多伦多地区'}
            </span>
          </div>

          {/* Search row: SearchBar + search button + AI button */}
          <div className="flex items-center gap-2 md:gap-3.5">
            <div className="flex-1 min-w-0">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={handleSearch}
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setInquiryOpen(true)}
              className="self-stretch flex-shrink-0 flex items-center justify-center gap-1.5
                         bg-white hover:bg-blue-50 active:bg-blue-100
                         text-primary-700 font-semibold rounded-2xl shadow-md
                         transition-colors px-3 md:px-3.5 whitespace-nowrap"
            >
              <Sparkles size={14} className="text-primary-500 flex-shrink-0" />
              <span className="text-sm font-bold">AI 帮你找</span>
            </motion.button>
          </div>
        </div>
      </div>

      <InquiryModal open={inquiryOpen} onClose={() => setInquiryOpen(false)} />

<div className="relative z-10 w-full bg-gray-50 pt-6">
      <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto">
        {/* Category buttons */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card p-4 mb-4"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-3">选择服务类型</h3>
          <CategoryButtons />
        </motion.section>

        {/* Recently browsed categories */}
        <RecentCategories />

        {/* Recent / nearby services */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              {userLocation ? '附近服务' : '最新服务'}
            </h3>
            <button
              onClick={() => navigate('/search')}
              className="text-xs text-primary-600 flex items-center gap-0.5"
            >
              查看全部 <ChevronRight size={14} />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {recent.map((svc) => (
              <ServiceCard key={svc.id} service={svc} />
            ))}
          </div>
        </motion.section>

        {/* Recommended for you */}
        <RecommendedServices />

        {/* Post CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-5 mb-8 text-white"
        >
          <h3 className="font-bold text-lg mb-1">有技能想接单？</h3>
          <p className="text-red-100 text-sm mb-3">免费发布您的服务，让附近有需要的客户找到您</p>
          <button
            onClick={() => navigate('/post')}
            className="bg-white text-primary-600 px-5 py-2 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors active:scale-95"
          >
            立即发布服务 →
          </button>
        </motion.div>
      </div>
      </div>
    </div>
  )
}
