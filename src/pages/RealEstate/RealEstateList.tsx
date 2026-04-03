// ─── Real Estate List Page ────────────────────────────────────────────────────
// Route: /realestate
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, SlidersHorizontal, MapPin, Plus, X,
  Phone, MessageCircle, Copy, Home, User, ExternalLink,
  BedDouble, Bath, Car, PawPrint, Zap,
} from 'lucide-react'
import Header from '../../components/Header/Header'
import SectionTabs from '../../components/SectionTabs/SectionTabs'
import { useRealEstateStore } from '../../store/realestateStore'
import { useAuthStore } from '../../store/authStore'
import {
  LISTING_TYPE_CONFIG, PROPERTY_TYPE_CONFIG, PRICE_TYPE_LABEL, getPriceLabel, getBedroomLabel,
  type Property, type RealEstateListingType, type PropertyType,
} from './types'

const GTA_AREAS = [
  '多伦多市区', '北约克', '士嘉堡', '密西沙加', '万锦',
  '列治文山', '奥克维尔', '宾顿', '安省其他',
]

export default function RealEstateList() {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)
  const { fetchProperties, setFilters, clearFilters, getFilteredProperties, filters, isReady } = useRealEstateStore()

  const [showFilters,  setShowFilters]  = useState(false)
  const [localKeyword, setLocalKeyword] = useState(filters.keyword ?? '')
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchProperties() }, [])

  const properties   = getFilteredProperties()
  const selectedProp = properties.find((p) => p.id === selectedId) ?? null

  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [selectedId])

  // Reset selection when listing type tab changes
  useEffect(() => { setSelectedId(null) }, [filters.listing_type])

  const handleSearch = () => setFilters({ keyword: localKeyword || undefined })

  function handleItemClick(p: Property) {
    if (window.innerWidth < 1024) {
      navigate(`/realestate/${p.id}`)
    } else {
      setSelectedId(p.id)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <Header />

      {/* ── Section tabs ────────────────────────────────────────────────────── */}
      <div className="bg-white flex-shrink-0 z-20">
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto">
          <SectionTabs active="realestate" onChange={() => {}} containerClassName="px-0" />
        </div>
      </div>

      {/* ── Search / filter bar ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 py-3 flex-shrink-0 z-20">
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto space-y-3">

          {/* Title + post button */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">租房买房</h1>
              <p className="text-xs text-gray-400">大多伦多华人房源</p>
            </div>
            <motion.button whileTap={{ scale: 0.95 }}
              onClick={() => user ? navigate('/realestate/post') : navigate('/login')}
              className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700
                         text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <Plus size={15} />
              发布房源
            </motion.button>
          </div>

          {/* 出租 / 出售 / 合租 sub-tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {(Object.keys(LISTING_TYPE_CONFIG) as RealEstateListingType[]).map((t) => (
              <button key={t}
                onClick={() => setFilters({ listing_type: t })}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  filters.listing_type === t
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {LISTING_TYPE_CONFIG[t].label}
              </button>
            ))}
          </div>

          {/* Search row */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
              <Search size={15} className="text-gray-400 flex-shrink-0" />
              <input
                value={localKeyword}
                onChange={(e) => setLocalKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索地址、描述..."
                className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
              />
              {localKeyword && (
                <button onClick={() => { setLocalKeyword(''); setFilters({ keyword: undefined }) }}>
                  <X size={14} className="text-gray-400" />
                </button>
              )}
            </div>
            <button onClick={handleSearch}
              className="bg-primary-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-primary-700 transition-colors">
              搜索
            </button>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`p-2.5 rounded-xl border transition-colors ${
                showFilters || filters.property_type || filters.area || filters.bedrooms != null
                  ? 'border-primary-400 text-primary-600 bg-primary-50'
                  : 'border-gray-200 text-gray-500 bg-white'
              }`}
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>

          {/* Filter panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden"
              >
                <div className="space-y-3 pt-1">
                  <FilterRow label="房屋类型">
                    <Chip active={!filters.property_type} onClick={() => setFilters({ property_type: undefined })}>全部</Chip>
                    {(Object.keys(PROPERTY_TYPE_CONFIG) as PropertyType[]).map((k) => (
                      <Chip key={k} active={filters.property_type === k}
                        onClick={() => setFilters({ property_type: filters.property_type === k ? undefined : k })}>
                        {PROPERTY_TYPE_CONFIG[k].emoji} {PROPERTY_TYPE_CONFIG[k].label}
                      </Chip>
                    ))}
                  </FilterRow>
                  <FilterRow label="卧室数量">
                    <Chip active={filters.bedrooms == null} onClick={() => setFilters({ bedrooms: undefined })}>全部</Chip>
                    {[0, 1, 2, 3, 4].map((n) => (
                      <Chip key={n} active={filters.bedrooms === n}
                        onClick={() => setFilters({ bedrooms: filters.bedrooms === n ? undefined : n })}>
                        {n === 0 ? 'Studio' : `${n}卧`}
                      </Chip>
                    ))}
                  </FilterRow>
                  <FilterRow label="地区">
                    <Chip active={!filters.area} onClick={() => setFilters({ area: undefined })}>全部</Chip>
                    {GTA_AREAS.map((a) => (
                      <Chip key={a} active={filters.area === a}
                        onClick={() => setFilters({ area: filters.area === a ? undefined : a })}>
                        {a}
                      </Chip>
                    ))}
                  </FilterRow>
                  <button onClick={() => { clearFilters(); setLocalKeyword('') }}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                    清除筛选
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Content area ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto flex gap-0 py-3">

        {/* ── Left: list ───────────────────────────────────────────────────── */}
        <div className={`flex flex-col overflow-hidden
          ${selectedProp ? 'hidden lg:flex lg:w-[380px] lg:flex-shrink-0' : 'w-full'}`}>
          <p className="text-xs text-gray-400 mb-2 flex-shrink-0">共 {properties.length} 个房源</p>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {!isReady ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                  <div className="h-32 bg-gray-100" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : properties.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <Home size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">暂无房源</p>
                <button onClick={() => navigate('/realestate/post')}
                  className="text-xs text-primary-600 underline mt-1">发布第一个房源</button>
              </div>
            ) : properties.map((p, i) => (
              <motion.div key={p.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => handleItemClick(p)}
                className={`bg-white rounded-2xl border overflow-hidden cursor-pointer transition-all duration-150
                  ${selectedId === p.id
                    ? 'border-primary-400 shadow-md ring-1 ring-primary-200'
                    : 'border-gray-100 shadow-sm hover:border-primary-200 hover:shadow-md'
                  }`}
              >
                {/* Cover image */}
                <div className="h-36 bg-gray-100 overflow-hidden relative">
                  {p.images.length > 0 ? (
                    <img src={p.images[0]} alt={p.title}
                      className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      {PROPERTY_TYPE_CONFIG[p.property_type].emoji}
                    </div>
                  )}
                  <span className={`absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full ${LISTING_TYPE_CONFIG[p.listing_type].color}`}>
                    {LISTING_TYPE_CONFIG[p.listing_type].label}
                  </span>
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-base font-bold text-primary-600 mb-1">{getPriceLabel(p)}</p>
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-1 mb-1.5">{p.title}</h3>
                  <div className="flex items-center flex-wrap gap-2 text-[11px] text-gray-500">
                    {p.bedrooms != null && (
                      <span className="flex items-center gap-0.5"><BedDouble size={11} />{getBedroomLabel(p.bedrooms)}</span>
                    )}
                    {p.bathrooms != null && (
                      <span className="flex items-center gap-0.5"><Bath size={11} />{p.bathrooms}卫</span>
                    )}
                    {p.area && p.area.length > 0 && (
                      <span className="flex items-center gap-0.5"><MapPin size={10} />{p.area[0]}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Right: detail panel ──────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {selectedProp && (
            <motion.div key={selectedProp.id}
              ref={detailRef}
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              className="hidden lg:flex flex-col flex-1 overflow-y-auto ml-4"
            >
              <DetailPanel prop={selectedProp} onClose={() => setSelectedId(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Inline detail panel ──────────────────────────────────────────────────────
function DetailPanel({ prop, onClose }: { prop: Property; onClose: () => void }) {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)
  const [imgIdx, setImgIdx] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => { setImgIdx(0) }, [prop.id])

  async function copyWechat() {
    if (!prop.contact_wechat) return
    try {
      await navigator.clipboard.writeText(prop.contact_wechat)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert(`微信号：${prop.contact_wechat}`)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Images */}
      {prop.images.length > 0 ? (
        <div>
          <div className="aspect-video overflow-hidden bg-gray-100">
            <img src={prop.images[imgIdx]} alt={prop.title} className="w-full h-full object-cover" />
          </div>
          {prop.images.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto">
              {prop.images.map((img, i) => (
                <button key={i} onClick={() => setImgIdx(i)}
                  className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                    imgIdx === i ? 'border-primary-500' : 'border-transparent'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-video bg-gray-50 flex items-center justify-center text-7xl">
          {PROPERTY_TYPE_CONFIG[prop.property_type].emoji}
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Price + type */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-2xl font-bold text-primary-600">{getPriceLabel(prop)}</p>
            <h1 className="text-base font-bold text-gray-900 mt-1 leading-snug">{prop.title}</h1>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${LISTING_TYPE_CONFIG[prop.listing_type].color}`}>
            {LISTING_TYPE_CONFIG[prop.listing_type].label}
          </span>
        </div>

        {/* Meta pills */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
            {PROPERTY_TYPE_CONFIG[prop.property_type].emoji} {PROPERTY_TYPE_CONFIG[prop.property_type].label}
          </span>
          {prop.bedrooms != null && (
            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
              <BedDouble size={11} />{getBedroomLabel(prop.bedrooms)}
            </span>
          )}
          {prop.bathrooms != null && (
            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
              <Bath size={11} />{prop.bathrooms} 卫
            </span>
          )}
          {prop.area && prop.area.length > 0 && (
            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
              <MapPin size={11} />{prop.area.join('·')}
            </span>
          )}
        </div>

        {/* Features */}
        {(prop.pet_friendly || prop.parking || prop.utilities_included) && (
          <div className="flex flex-wrap gap-2">
            {prop.pet_friendly && (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                <PawPrint size={11} />可养宠物
              </span>
            )}
            {prop.parking && (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                <Car size={11} />含停车位
              </span>
            )}
            {prop.utilities_included && (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                <Zap size={11} />含水电网
              </span>
            )}
          </div>
        )}

        {/* Available date + address */}
        {(prop.available_date || prop.address) && (
          <div className="text-sm text-gray-600 space-y-1">
            {prop.available_date && (
              <p>📅 可入住：{new Date(prop.available_date).toLocaleDateString('zh-CN')}</p>
            )}
            {prop.address && <p>📍 {prop.address}</p>}
          </div>
        )}

        {/* Contact */}
        <div className="flex gap-2">
          <a href={`tel:${prop.contact_phone}`}
            className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700
                       text-white text-sm font-semibold py-2.5 rounded-xl transition-colors active:scale-95">
            <Phone size={15} />
            {prop.contact_phone}
          </a>
          {prop.contact_wechat && (
            <button onClick={copyWechat}
              className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600
                         text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors active:scale-95">
              {copied ? <Copy size={15} /> : <MessageCircle size={15} />}
              {copied ? '已复制' : '微信'}
            </button>
          )}
        </div>

        {/* Description */}
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">房源描述</p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{prop.description}</p>
        </div>

        {/* Poster */}
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">发布者</p>
          <div className="flex items-center gap-3">
            <div
              onClick={() => prop.poster && navigate(`/provider/${prop.poster.id}`)}
              className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0
                         cursor-pointer ring-2 ring-primary-200 hover:ring-primary-400 transition-all"
            >
              {prop.poster?.avatar_url
                ? <img src={prop.poster.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                : <User size={16} className="text-primary-600" />
              }
            </div>
            <span className="text-sm font-medium text-gray-800 flex-1">{prop.contact_name}</span>
            {prop.poster && (
              <button
                onClick={() => navigate(`/provider/${prop.poster!.id}`)}
                className="flex items-center gap-1.5 text-xs text-primary-600 font-semibold
                           bg-primary-50 hover:bg-primary-100 border border-primary-200
                           px-3 py-1.5 rounded-xl transition-colors"
              >
                <ExternalLink size={12} />
                查看主页
              </button>
            )}
          </div>
        </div>

        {/* CTA */}
        {(!user || user.id !== prop.poster_id) && (
          <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 text-center">
            <p className="text-xs text-primary-700 mb-1">有房源要发布？</p>
            <button onClick={() => user ? navigate('/realestate/post') : navigate('/login')}
              className="text-xs text-primary-600 font-semibold underline">免费发布房源</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
        active ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}>
      {children}
    </button>
  )
}
