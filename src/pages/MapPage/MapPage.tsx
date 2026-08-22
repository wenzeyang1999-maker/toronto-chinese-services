// ─── Fullscreen Map Page ──────────────────────────────────────────────────────
// Route: /map  — Google Maps-style fullscreen experience with top search bar
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Navigation, X, Sparkles, Map as MapIcon, List, Loader2 } from 'lucide-react'
import Header from '../../components/Header/Header'
import Mascot from '../../components/Mascot/Mascot'
import ServiceCard from '../../components/ServiceCard/ServiceCard'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'
import { useGeolocation, useUpdateLocation, LOCATION_STALE_MS } from '../../hooks/useGeolocation'
import { supabase } from '../../lib/supabase'
import GoogleMapCanvas, { type GoogleMapCanvasHandle, type GoogleMapPoint } from '../../components/ServiceMap/GoogleMapCanvas'
import type { Service, OnlineProvider } from '../../types'
import { buildServiceInfo, buildDemandInfo, buildOnlineProviderInfo } from '../../lib/mapInfoWindows'
import { fuzzyFilterServices, fuzzyFilterRequests } from '../../lib/fuzzySearch'
import { smartSearch, smartRouteToUrl } from '../../lib/smartSearch'

function hasCoordinates(service: Service): service is Service & {
  location: { lat: number; lng: number; address: string; city: string; area?: string }
} {
  return service.location.lat != null && service.location.lng != null
}

export default function MapPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState<'services' | 'requests'>(
    searchParams.get('type') === 'requests' ? 'requests' : 'services'
  )
  const requestsMode = mode === 'requests'
  const services = useAppStore((s) => s.services)
  const serviceRequests = useAppStore((s) => s.serviceRequests)
  const userLocation = useAppStore((s) => s.userLocation)
  const user = useAuthStore((s) => s.user)
  const requestLocation = useGeolocation()
  const { updateLocation } = useUpdateLocation()
  const mapRef = useRef<GoogleMapCanvasHandle>(null)
  const [search, setSearch] = useState('')
  const [onlineProviders, setOnlineProviders] = useState<OnlineProvider[]>([])
  const [display, setDisplay] = useState<'map' | 'list'>('map')   // 地图 / 列表(内测#10)
  const [routing, setRouting] = useState(false)                   // AI 全站搜索跳转中
  const [orderFilter, setOrderFilter] = useState<'all' | 'urgent' | 'scheduled'>('all')  // 找订单:急单/预约单

  // 地图搜索回车 → AI 全站解析:跨板块(房产/二手/招聘/社区)跳对应板块,
  // 服务/订单留在本页(已由输入实时筛选)。(内测#6+#10)
  async function handleSmartEnter() {
    const q = search.trim()
    if (!q || routing) return
    setRouting(true)
    const r = await smartSearch(q)
    setRouting(false)
    if (r && r.domain !== 'service') navigate(smartRouteToUrl(r))
  }

  // Auto-request location on mount; refresh if the cached fix is stale (>10 min).
  useEffect(() => {
    requestLocation({ maxAgeMs: LOCATION_STALE_MS })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (requestsMode) return
    let cancelled = false
    supabase.from('users')
      .select('id, name, avatar_url, online_lat, online_lng, skill_tags')
      .eq('is_online', true)
      .not('online_lat', 'is', null)
      .not('online_lng', 'is', null)
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.warn('[MapPage] online providers fetch failed:', error.message); return }
        if (data) setOnlineProviders(data as OnlineProvider[])
      })
    return () => { cancelled = true }
  }, [requestsMode])

  // Provider mode: also show service requests as orange pins
  const isProvider = !!user && services.some((s) => s.provider.id === user.id)

  const kw = search.trim().toLowerCase()
  // 在线师傅用轻量二字分词匹配（fuzzySearch 只覆盖 Service/ServiceRequest）。
  const terms = kw
    ? Array.from(new Set(
        kw.split(/\s+/).filter(Boolean).flatMap((w) => {
          const parts = [w]
          for (let i = 0; i < w.length - 1; i++) parts.push(w.slice(i, i + 2))
          return parts
        })
      ))
    : []
  const matches = (text: string | null | undefined) =>
    !kw || terms.some((term) => (text ?? '').toLowerCase().includes(term))

  // 服务/需求：复用与主搜索(Home/Search)完全相同的模糊搜索
  // （Fuse.js + 同义词扩展 + 类目标签），相关的都出来。
  const mapped = useMemo(() => {
    const withCoords = services.filter(hasCoordinates)
    const filtered = kw ? fuzzyFilterServices(withCoords, kw) : withCoords
    // 内测#8：找服务「搜索关键词」后，只显示当前【上线接单】的服务商，
    // 隐藏【停止接单】的(离线)。无搜索时仍展示全部,方便浏览。
    return kw ? filtered.filter((s) => s.provider.isOnline) : filtered
  }, [services, kw])

  // 找订单 列表数据(列表视图不强制要坐标)(内测#10)
  const requestList = useMemo(() => {
    const base = kw ? fuzzyFilterRequests(serviceRequests, kw) : serviceRequests
    return orderFilter === 'all' ? base
      : base.filter((r) => orderFilter === 'urgent' ? r.isUrgent : !r.isUrgent)
  }, [serviceRequests, kw, orderFilter])

  const servicePoints = useMemo<GoogleMapPoint[]>(() => {
    // 找服务:没输入关键词搜索前,地图只显示「我的位置」,不铺服务针(内测20260818 一)
    if (requestsMode || !kw) return []
    return mapped.map((service) => ({
      id: service.id,
      lat: service.location.lat!,
      lng: service.location.lng!,
      title: service.title,
      promoted: service.isPromoted,
      infoContent: buildServiceInfo(
        service,
        () => navigate(`/service/${service.id}`),
        () => navigate(`/provider/${service.provider.id}`),
      ),
    }))
  }, [mapped, navigate, requestsMode])

  const requestPoints = useMemo<GoogleMapPoint[]>(() => {
    // In requestsMode mode, show all customer requests (don't gate by isProvider)
    if (!requestsMode && !isProvider) return []
    const withCoords = serviceRequests.filter((r) => r.lat != null && r.lng != null)
    const kwFiltered = kw ? fuzzyFilterRequests(withCoords, kw) : withCoords
    // 急单/预约单 筛选(内测20260818 一)
    const list = orderFilter === 'all' ? kwFiltered
      : kwFiltered.filter((r) => orderFilter === 'urgent' ? r.isUrgent : !r.isUrgent)
    return list
      .map((r) => ({
        id: `req-${r.id}`,
        lat: r.lat!,
        lng: r.lng!,
        title: r.title,
        promoted: false,
        demandPin: true,
        urgent: r.isUrgent,   // 🔴急单 / 🔵预约单 上色
        infoContent: buildDemandInfo(r, () => navigate(`/requests/${r.id}`)),
      } as GoogleMapPoint & { urgent?: boolean }))
  }, [serviceRequests, isProvider, navigate, kw, requestsMode, orderFilter])

  const onlinePoints = useMemo<GoogleMapPoint[]>(() => {
    // 找订单模式不显示在线商家;找服务模式「搜索关键词后」才显示在线商家(内测20260818 一)
    if (requestsMode || !kw) return []
    return onlineProviders
      .filter((p) => matches(p.name) || p.skill_tags.some(t => matches(t)))
      .map((p) => ({
        id: `online-${p.id}`,
        lat: p.online_lat,
        lng: p.online_lng,
        title: p.name,
        promoted: false,
        onlineProv: true,
        infoContent: buildOnlineProviderInfo(p, () => navigate(`/provider/${p.id}`)),
      } as GoogleMapPoint))
  }, [onlineProviders, navigate, kw, requestsMode])

  const points = useMemo(
    () => [...servicePoints, ...requestPoints, ...onlinePoints],
    [servicePoints, requestPoints, onlinePoints]
  )

  const center = userLocation ?? { lat: 43.7, lng: -79.42 }

  function handleLocate() {
    // 蓝色箭头 = 定位到我 + 顺带刷新一次位置(内测2-#3:已删「更新位置」按钮,合二为一)
    if (userLocation) {
      mapRef.current?.panToUser()
      updateLocation(() => mapRef.current?.panToUser())
    } else {
      requestLocation()
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-white">
      {/* 顶部站点导航栏(内测#7:华邻地图作为独立页面,带全站导航)。
          本页是满屏 flex 列、不该内部滚动,Header 用随流定位(非 sticky)——
          否则父层 pb-16 造成的文档级滚动会让 sticky Header 盖住下面 top-3 的悬浮卡片。 */}
      <Header sticky={false} />

      {/* 地图区域：填满导航栏下方,控件悬浮其上 */}
      <div className="relative flex-1 min-h-0">
      <div className="absolute inset-0">
        <GoogleMapCanvas
          ref={mapRef}
          center={center}
          zoom={userLocation ? 13 : 11}
          points={points}
          userLocation={userLocation}
        />
      </div>

      {/* 悬浮·切换卡片 + 搜索框（叠放在地图顶部） */}
      <div className="absolute top-3 left-3 right-3 z-30 space-y-2
                      lg:left-1/2 lg:right-auto lg:w-[680px] lg:-translate-x-1/2">
        {/* 找服务 / 找订单 悬浮切换卡片 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode('services')}
            aria-pressed={!requestsMode}
            className={`relative flex items-center gap-2.5 p-2.5 rounded-2xl border-2 text-left transition-all active:scale-[0.98] bg-white shadow-lg
              ${!requestsMode ? 'border-primary-500' : 'border-transparent hover:border-gray-200'}`}
          >
            <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors
              ${!requestsMode ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
              <Search size={16} strokeWidth={2.4} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold truncate ${!requestsMode ? 'text-primary-700' : 'text-gray-700'}`}>找服务</p>
              <p className="text-[11px] text-gray-400 truncate mt-0.5">附近商家 · 师傅</p>
            </div>
          </button>
          <button
            onClick={() => setMode('requests')}
            aria-pressed={requestsMode}
            className={`relative flex items-center gap-2.5 p-2.5 rounded-2xl border-2 text-left transition-all active:scale-[0.98] bg-white shadow-lg
              ${requestsMode ? 'border-amber-500' : 'border-transparent hover:border-gray-200'}`}
          >
            <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors
              ${requestsMode ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
              <Sparkles size={16} strokeWidth={2.4} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold truncate ${requestsMode ? 'text-amber-700' : 'text-gray-700'}`}>找订单</p>
              <p className="text-[11px] text-gray-400 truncate mt-0.5">接附近订单 · 赚钱</p>
            </div>
          </button>
        </div>
        {/* 搜索框 — 回车走 AI 全站解析(内测#6/#10) */}
        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2.5 shadow-lg">
          {routing
            ? <Loader2 size={16} className="text-primary-500 animate-spin flex-shrink-0" />
            : <Search size={16} className="text-gray-400 flex-shrink-0" />}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSmartEnter() }}
            placeholder={requestsMode ? '搜索需求、关键词…' : '想找什么直接说，回车全站搜索'}
            className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400 min-w-0"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 flex-shrink-0" aria-label="清空搜索">
              <X size={16} />
            </button>
          )}
        </div>

        {/* 找订单:急单 / 预约单 筛选(内测20260818 一) */}
        {requestsMode && (
          <div className="inline-flex items-center gap-0.5 rounded-full bg-white p-0.5 shadow text-xs self-start">
            {([['all', '全部'], ['urgent', '🔴 急单'], ['scheduled', '🔵 预约单']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setOrderFilter(k)}
                className={`px-3 py-1 rounded-full font-semibold transition-colors
                  ${orderFilter === k ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* 结果计数 + 地图/列表 切换(内测#10) */}
        <div className="flex items-center justify-between gap-2">
          <span className="bg-white/95 backdrop-blur rounded-full px-3 py-1 shadow text-xs font-semibold text-gray-700">
            {requestsMode
              ? `${requestList.length} 条需求`
              : (kw ? `${mapped.length} 位在线服务商` : '搜索关键词查看在线服务商')}
          </span>
          <div className="inline-flex items-center gap-0.5 rounded-full bg-white p-0.5 shadow text-xs">
            <button
              onClick={() => setDisplay('map')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold transition-colors
                ${display === 'map' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <MapIcon size={12} /> 地图
            </button>
            <button
              onClick={() => setDisplay('list')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold transition-colors
                ${display === 'list' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List size={12} /> 列表
            </button>
          </div>
        </div>
      </div>

      {/* 列表视图(内测#10):覆盖地图,与地图同一批结果 */}
      {display === 'list' && (
        <div className="absolute inset-0 z-20 bg-gray-50 overflow-y-auto pt-[11.75rem] px-3 pb-24">
          {requestsMode ? (
            requestList.length === 0 ? (
              <div className="flex flex-col items-center pt-16 text-center">
                <Mascot pose="curious" size={72} className="mb-2" />
                <p className="text-sm text-gray-500">{kw ? `没有找到「${search}」相关订单` : '附近暂无订单'}</p>
              </div>
            ) : (
              <div className="grid gap-2.5 max-w-2xl mx-auto">
                {requestList.map((r) => (
                  <button key={r.id} onClick={() => navigate(`/requests/${r.id}`)}
                    className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-start gap-3 active:scale-[0.99] transition-transform">
                    <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${r.isUrgent ? 'bg-red-500' : 'bg-blue-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{r.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {r.isUrgent ? '🔴 急单' : '🔵 预约单'}{r.area ? ` · ${r.area}` : ''}{r.budget ? ` · ${r.budget}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            !kw ? (
              <div className="flex flex-col items-center pt-16 text-center px-6">
                <Mascot pose="curious" size={72} className="mb-2" />
                <p className="text-sm text-gray-500">搜索关键词(如「搬运」「保洁」)查看附近正在上线接单的服务商</p>
              </div>
            ) : mapped.length === 0 ? (
              <div className="flex flex-col items-center pt-16 text-center">
                <Mascot pose="curious" size={72} className="mb-2" />
                <p className="text-sm text-gray-500">没有找到「{search}」相关的在线服务商</p>
              </div>
            ) : (
              <div className="grid gap-3 max-w-2xl mx-auto">
                {mapped.map((s) => <ServiceCard key={s.id} service={s} />)}
              </div>
            )
          )}
        </div>
      )}

      {/* 地图控件仅在地图视图显示(内测#10) */}
      {display === 'map' && (
      <button
        onClick={handleLocate}
        className={`absolute bottom-6 left-4 z-30 w-12 h-12 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all
          ${userLocation ? 'bg-white hover:bg-gray-50' : 'bg-primary-600 hover:bg-primary-700'}`}
        aria-label="定位到我的位置"
      >
        <Navigation size={20} className={userLocation ? 'text-primary-600' : 'text-white'} fill={userLocation ? 'currentColor' : 'white'} />
      </button>
      )}

      {/* 「更新位置」按钮已删(内测2-#3):与蓝色定位箭头作用重复,合进 handleLocate */}

      {/* 无结果(仅地图视图;列表视图有自己的空状态) */}
      {display === 'map' && kw && points.length === 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-white rounded-2xl shadow-lg p-6 text-center flex flex-col items-center">
          <Mascot pose="curious" size={80} className="mb-1" />
          <p className="text-sm font-semibold text-gray-700 mb-1">没有找到「{search}」</p>
          <p className="text-xs text-gray-400">换个关键词试试</p>
        </div>
      )}
      </div>
    </div>
  )
}
