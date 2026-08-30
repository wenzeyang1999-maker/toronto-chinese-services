// ─── 全部商家目录 ─────────────────────────────────────────────────────────────
// 「查看所有服务」展开页:已注册服务商 + 网上收录商家统一列出。
//   颜色区分:在线接单(绿) / 暂未上线(灰) / 待认领(琥珀)
//   徽章区分:已认证(盾) / 待认领
// 数据走公开 RPC merchant_showcase(不含联系方式;点进详情才看电话)。
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Store } from 'lucide-react'
import Header from '../../components/Header/Header'
import { supabase } from '../../lib/supabase'

type MerchantStatus = 'online' | 'offline' | 'unclaimed'
interface Merchant {
  source: 'user' | 'directory'
  id: string
  name: string
  avatar_url: string | null
  bio: string | null
  category_id: string | null
  area: string | null
  status: MerchantStatus
  verified: boolean
}

type Filter = 'all' | MerchantStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',       label: '全部' },
  { key: 'online',    label: '在线接单' },
  { key: 'offline',   label: '暂未上线' },
  { key: 'unclaimed', label: '待认领' },
]

export default function MerchantsPage() {
  const navigate = useNavigate()
  const [list, setList] = useState<Merchant[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    supabase.rpc('merchant_showcase', { p_limit: 100 }).then(({ data }) => {
      if (data) setList(data as Merchant[])
      setLoading(false)
    })
  }, [])

  const counts = useMemo(() => ({
    all: list.length,
    online: list.filter((m) => m.status === 'online').length,
    offline: list.filter((m) => m.status === 'offline').length,
    unclaimed: list.filter((m) => m.status === 'unclaimed').length,
  }), [list])

  const shown = filter === 'all' ? list : list.filter((m) => m.status === filter)

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <Header />

      <div className="mx-auto w-full max-w-3xl px-3 py-4">
        {/* 标题 */}
        <div className="flex items-center gap-2 mb-1">
          <Store size={18} className="text-primary-600" />
          <h1 className="text-lg font-bold text-gray-900">全部商家</h1>
          <span className="text-sm font-semibold text-primary-600">{counts.all}</span>
        </div>
        <p className="text-xs text-gray-400 mb-3">已注册服务商 + 平台收录商家。点开看详情与联系方式。</p>

        {/* 图例 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />在线接单</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" />暂未上线</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />待认领</span>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={11} className="text-emerald-500" />已认证</span>
        </div>

        {/* 筛选 */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide mb-4">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                filter === f.key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {f.label} <span className={filter === f.key ? 'text-white/80' : 'text-gray-400'}>{counts[f.key]}</span>
            </button>
          ))}
        </div>

        {/* 列表 */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : shown.length === 0 ? (
          <div className="text-center py-20 text-sm text-gray-400">该状态下暂无商家</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {shown.map((m) => {
              const online    = m.status === 'online'
              const unclaimed = m.status === 'unclaimed'
              return (
                <button key={`${m.source}-${m.id}`}
                  onClick={() => navigate(m.source === 'user' ? `/provider/${m.id}` : `/merchant/${m.id}`)}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all active:scale-[0.98] shadow-sm ${
                    online ? 'bg-white border-emerald-200 hover:border-emerald-300'
                           : unclaimed ? 'bg-white border-amber-200 hover:border-amber-300'
                                       : 'bg-gray-50 border-gray-100 hover:border-gray-200'}`}>
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ring-1 ${
                    online ? 'ring-emerald-200 bg-emerald-50' : unclaimed ? 'ring-amber-200 bg-amber-50' : 'ring-gray-200 bg-gray-100'} ${
                    !online && !unclaimed ? 'grayscale opacity-80' : ''}`}>
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt="" className="w-11 h-11 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      : <span className={`text-base font-bold ${online ? 'text-emerald-600' : unclaimed ? 'text-amber-600' : 'text-gray-400'}`}>{(m.name || '商').slice(0, 1)}</span>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm font-bold truncate ${online || unclaimed ? 'text-gray-900' : 'text-gray-500'}`}>{m.name || '商家'}</p>
                      {m.verified && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5 flex-shrink-0">
                          <ShieldCheck size={10} />已认证
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{m.bio || (m.area ? `${m.area} · 华人本地服务` : '华人本地服务商家')}</p>
                  </div>

                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
                    online ? 'text-emerald-600 bg-emerald-50 border border-emerald-200'
                           : unclaimed ? 'text-amber-600 bg-amber-50 border border-amber-200'
                                       : 'text-gray-400 bg-gray-100 border border-gray-200'}`}>
                    {online && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                    {online ? '在线接单' : unclaimed ? '待认领' : '暂未上线'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
