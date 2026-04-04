// ─── Secondhand List Page ─────────────────────────────────────────────────────
// Route: /secondhand
// Desktop (≥ lg): split — left scrollable list, right detail panel
// Mobile  (< lg): single column, clicking navigates to /secondhand/:id
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, SlidersHorizontal, MapPin, Plus, X,
  Phone, MessageCircle, Copy, Package, User, ExternalLink,
} from 'lucide-react'
import Header from '../../components/Header/Header'
import SectionTabs from '../../components/SectionTabs/SectionTabs'
import { useSecondhandStore } from '../../store/secondhandStore'
import { useAuthStore } from '../../store/authStore'
import {
  SECONDHAND_CATEGORY_CONFIG, ITEM_CONDITION_CONFIG, getPriceLabel,
  type SecondhandItem, type SecondhandCategory, type ItemCondition,
} from './types'

const GTA_AREAS = [
  '多伦多市区', '北约克', '士嘉堡', '密西沙加', '万锦',
  '列治文山', '奥克维尔', '宾顿', '安省其他',
]

export default function SecondhandList() {
  const navigate  = useNavigate()
  const user      = useAuthStore((s) => s.user)
  const { fetchItems, setFilters, clearFilters, getFilteredItems, filters, isReady } = useSecondhandStore()

  const [showFilters,  setShowFilters]  = useState(false)
  const [localKeyword, setLocalKeyword] = useState(filters.keyword ?? '')
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchItems() }, [])

  const items       = getFilteredItems()
  const selectedItem = items.find((i) => i.id === selectedId) ?? null

  // No auto-selection — user clicks to open detail panel

  // Scroll detail panel to top on selection change
  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [selectedId])

  const handleSearch = () => setFilters({ keyword: localKeyword || undefined })

  function handleItemClick(item: SecondhandItem) {
    if (window.innerWidth < 1024) {
      navigate(`/secondhand/${item.id}`)
    } else {
      setSelectedId(item.id)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <Header />

      {/* ── Section tabs ────────────────────────────────────────────────────── */}
      <div className="bg-white flex-shrink-0 z-20">
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto">
          <SectionTabs active="secondhand" onChange={() => {}} containerClassName="px-0" />
        </div>
      </div>

      {/* ── Search / filter bar ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 py-3 flex-shrink-0 z-20">
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto space-y-3">

          {/* Title + post button */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">二手交易</h1>
              <p className="text-xs text-gray-400">大多伦多华人闲置转让</p>
            </div>
            <motion.button whileTap={{ scale: 0.95 }}
              onClick={() => user ? navigate('/secondhand/post') : navigate('/login')}
              className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700
                         text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <Plus size={15} />
              发布闲置
            </motion.button>
          </div>

          {/* Search row */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
              <Search size={15} className="text-gray-400 flex-shrink-0" />
              <input
                value={localKeyword}
                onChange={(e) => setLocalKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索物品..."
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
                showFilters || filters.category || filters.condition || filters.area
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
                  <FilterRow label="分类">
                    <Chip active={!filters.category} onClick={() => setFilters({ category: undefined })}>全部</Chip>
                    {(Object.keys(SECONDHAND_CATEGORY_CONFIG) as SecondhandCategory[]).map((k) => (
                      <Chip key={k} active={filters.category === k}
                        onClick={() => setFilters({ category: filters.category === k ? undefined : k })}>
                        {SECONDHAND_CATEGORY_CONFIG[k].emoji} {SECONDHAND_CATEGORY_CONFIG[k].label}
                      </Chip>
                    ))}
                  </FilterRow>
                  <FilterRow label="成色">
                    <Chip active={!filters.condition} onClick={() => setFilters({ condition: undefined })}>全部</Chip>
                    {(Object.keys(ITEM_CONDITION_CONFIG) as ItemCondition[]).map((k) => (
                      <Chip key={k} active={filters.condition === k}
                        onClick={() => setFilters({ condition: filters.condition === k ? undefined : k })}>
                        {ITEM_CONDITION_CONFIG[k].label}
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
                    清除所有筛选
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Content area ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto flex gap-0 py-3">

        {/* ── Left: item list ──────────────────────────────────────────────── */}
        <div className={`flex flex-col overflow-hidden
          ${selectedItem ? 'hidden lg:flex lg:w-[380px] lg:flex-shrink-0' : 'w-full'}`}>
          <p className="text-xs text-gray-400 mb-2 flex-shrink-0">共 {items.length} 件物品</p>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {!isReady ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-4 animate-pulse flex gap-3">
                  <div className="w-16 h-16 bg-gray-100 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : items.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <Package size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">暂无物品</p>
                <button onClick={() => navigate('/secondhand/post')}
                  className="text-xs text-primary-600 underline mt-1">发布第一件闲置</button>
              </div>
            ) : items.map((item, i) => (
              <motion.div key={item.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => handleItemClick(item)}
                className={`bg-white rounded-2xl border p-3 cursor-pointer transition-all duration-150 flex gap-3
                  ${selectedId === item.id
                    ? 'border-primary-400 shadow-md ring-1 ring-primary-200'
                    : 'border-gray-100 shadow-sm hover:border-primary-200 hover:shadow-md'
                  }`}
              >
                {/* Thumbnail */}
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                  {item.images.length > 0 ? (
                    <img src={item.images[0]} alt={item.title}
                      className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">
                      {SECONDHAND_CATEGORY_CONFIG[item.category].emoji}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 flex-1">
                      {item.title}
                    </h3>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${ITEM_CONDITION_CONFIG[item.condition].color}`}>
                      {ITEM_CONDITION_CONFIG[item.condition].label}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-primary-600 mb-1">{getPriceLabel(item)}</p>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span>{SECONDHAND_CATEGORY_CONFIG[item.category].emoji} {SECONDHAND_CATEGORY_CONFIG[item.category].label}</span>
                    {item.area && item.area.length > 0 && (
                      <span className="flex items-center gap-0.5">
                        <MapPin size={9} />{item.area[0]}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Right: detail panel (desktop only) ───────────────────────────── */}
        <AnimatePresence mode="wait">
          {selectedItem && (
            <motion.div key={selectedItem.id}
              ref={detailRef}
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              className="hidden lg:flex flex-col flex-1 overflow-y-auto ml-4"
            >
              <DetailPanel item={selectedItem} onClose={() => setSelectedId(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Inline detail panel ──────────────────────────────────────────────────────
function DetailPanel({ item, onClose }: { item: SecondhandItem; onClose: () => void }) {
  const navigate  = useNavigate()
  const user      = useAuthStore((s) => s.user)
  const [imgIdx,  setImgIdx]  = useState(0)
  const [copied,  setCopied]  = useState(false)

  // Reset image index when item changes
  useEffect(() => { setImgIdx(0) }, [item.id])

  async function copyWechat() {
    if (!item.contact_wechat) return
    try {
      await navigator.clipboard.writeText(item.contact_wechat)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert(`微信号：${item.contact_wechat}`)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4">
      {/* Images */}
      {item.images.length > 0 ? (
        <div className="relative">
          <div className="aspect-video overflow-hidden bg-gray-100 rounded-t-2xl">
            <img src={item.images[imgIdx]} alt={item.title}
              className="w-full h-full object-contain" />
          </div>
          {item.images.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto">
              {item.images.map((img, i) => (
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
        <div className="aspect-video bg-gray-50 flex items-center justify-center text-6xl">
          {SECONDHAND_CATEGORY_CONFIG[item.category].emoji}
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Title + condition */}
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900 leading-tight flex-1">{item.title}</h1>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${ITEM_CONDITION_CONFIG[item.condition].color}`}>
            {ITEM_CONDITION_CONFIG[item.condition].label}
          </span>
        </div>

        {/* Price */}
        <p className={`text-2xl font-bold ${item.is_free ? 'text-green-600' : 'text-primary-600'}`}>
          {getPriceLabel(item)}
        </p>

        {/* Meta pills */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
            {SECONDHAND_CATEGORY_CONFIG[item.category].emoji} {SECONDHAND_CATEGORY_CONFIG[item.category].label}
          </span>
          {item.area && item.area.length > 0 && (
            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
              <MapPin size={11} />{item.area.join('·')}
            </span>
          )}
          <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
            {new Date(item.created_at).toLocaleDateString('zh-CN')}
          </span>
        </div>

        {/* Contact */}
        <div className="flex gap-2">
          <a href={`tel:${item.contact_phone}`}
            className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700
                       text-white text-sm font-semibold py-2.5 rounded-xl transition-colors active:scale-95">
            <Phone size={15} />
            {item.contact_phone}
          </a>
          {item.contact_wechat && (
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
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">物品描述</p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.description}</p>
        </div>

        {/* Seller */}
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">卖家</p>
          <div className="flex items-center gap-3">
            <div
              onClick={() => item.seller && navigate(`/provider/${item.seller.id}`)}
              className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0
                         cursor-pointer ring-2 ring-primary-200 hover:ring-primary-400 transition-all"
            >
              {item.seller?.avatar_url
                ? <img src={item.seller.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                : <User size={16} className="text-primary-600" />
              }
            </div>
            <span className="text-sm font-medium text-gray-800 flex-1">{item.contact_name}</span>
            {item.seller && (
              <button
                onClick={() => navigate(`/provider/${item.seller!.id}`)}
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
        {(!user || user.id !== item.seller_id) && (
          <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 text-center">
            <p className="text-xs text-primary-700 mb-1">有闲置要出售？</p>
            <button onClick={() => user ? navigate('/secondhand/post') : navigate('/login')}
              className="text-xs text-primary-600 font-semibold underline">
              免费发布闲置
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────
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
