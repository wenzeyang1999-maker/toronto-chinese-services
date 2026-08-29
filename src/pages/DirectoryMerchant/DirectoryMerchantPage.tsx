// ─── 收录商家详情页(帖子)──────────────────────────────────────────────────────
// 「平台公开资料收录 · 尚未认领」商家的详情。公开商业电话只在此页显示(列表/橱窗不显示)。
// 含免责声明 + 「认领此商家」入口。数据走 merchant_detail RPC(按 id 返回单条,含电话)。
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, MapPin, Languages, Globe, Info, BadgeCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from '../../lib/toast'
import { useAuthStore } from '../../store/authStore'
import { getCategoryById } from '../../data/categories'

interface Detail {
  id: string
  name: string
  avatar_url: string | null
  bio: string | null
  category_id: string | null
  area: string | null
  languages: string | null
  keywords: string[] | null
  phone: string | null
  wechat: string | null
  website: string | null
  status: string
}

export default function DirectoryMerchantPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [m, setM] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase.rpc('merchant_detail', { p_id: id }).then(({ data }) => {
      setM((data as Detail) ?? null)
      setLoading(false)
    })
  }, [id])

  async function handleClaim() {
    if (!id) return
    if (!user) { navigate('/login', { state: { from: `/merchant/${id}`, claimMerchant: id } }); return }
    setClaiming(true)
    const { data, error } = await supabase.rpc('claim_merchant', { p_id: id })
    setClaiming(false)
    if (error || !(data as { ok?: boolean })?.ok) {
      toast(error?.message === 'merchant_unavailable' ? '该商家已被认领' : '认领失败，请重试', 'error')
      return
    }
    toast('认领成功！请完善你的商家资料', 'success')
    navigate('/profile')
  }

  const cat = m?.category_id ? getCategoryById(m.category_id as never) : undefined

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-white border-b border-gray-100 px-3 py-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"><ArrowLeft size={20} /></button>
        <h1 className="text-base font-bold text-gray-900 truncate">商家详情</h1>
      </div>

      <div className="mx-auto w-full max-w-lg px-4 py-5">
        {loading ? (
          <div className="space-y-3">
            <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
            <div className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
          </div>
        ) : !m ? (
          <div className="text-center py-20">
            <p className="text-sm text-gray-500 mb-3">该商家不存在，或已被认领</p>
            <button onClick={() => navigate('/')} className="text-sm text-primary-600 font-semibold">返回首页</button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 收录标识 */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> 平台公开资料收录 · 商家尚未认领
            </div>

            {/* 头部名片 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-amber-50 ring-1 ring-amber-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {m.avatar_url
                  ? <img src={m.avatar_url} alt="" className="w-14 h-14 object-cover" />
                  : <span className="text-xl font-bold text-amber-600">{m.name.slice(0, 1)}</span>}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900 truncate">{m.name}</h2>
                {cat && <p className="text-xs text-gray-400 mt-0.5">{cat.postLabel}</p>}
              </div>
            </div>

            {/* 信息 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3 text-sm">
              {m.bio && <p className="text-gray-700 leading-relaxed">{m.bio}</p>}
              {m.area && <div className="flex items-center gap-2 text-gray-600"><MapPin size={15} className="text-gray-400 flex-shrink-0" />{m.area}</div>}
              {m.languages && <div className="flex items-center gap-2 text-gray-600"><Languages size={15} className="text-gray-400 flex-shrink-0" />{m.languages}</div>}
              {m.website && (
                <a href={m.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary-600 hover:underline break-all">
                  <Globe size={15} className="text-gray-400 flex-shrink-0" />{m.website}
                </a>
              )}
              {/* 公开电话:只在此页显示 */}
              {m.phone && (
                <a href={`tel:${m.phone}`}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary-600 text-white font-semibold py-2.5 hover:bg-primary-700 transition-colors mt-1">
                  <Phone size={16} /> {m.phone}
                </a>
              )}
              {m.keywords && m.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {m.keywords.map((k) => (
                    <span key={k} className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">{k}</span>
                  ))}
                </div>
              )}
            </div>

            {/* 免责声明 */}
            <div className="flex gap-2 rounded-2xl bg-gray-50 border border-gray-100 p-3 text-[12px] text-gray-500 leading-relaxed">
              <Info size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
              <p>资料整理自该商家公开商业信息，实际服务内容、价格及可用时间请向商家确认。华邻未对该商家进行认证。</p>
            </div>

            {/* 认领入口 */}
            <button onClick={handleClaim} disabled={claiming}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-amber-500 text-white font-bold py-3 shadow-sm hover:bg-amber-600 transition-colors disabled:opacity-50">
              <BadgeCheck size={18} /> {claiming ? '认领中…' : '这是我的商家 · 认领此商家'}
            </button>
            <p className="text-center text-[11px] text-gray-400">认领后可完善资料、通过认证、上线接单</p>
          </div>
        )}
      </div>
    </div>
  )
}
