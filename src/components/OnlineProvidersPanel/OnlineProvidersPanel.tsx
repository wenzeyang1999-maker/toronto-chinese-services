// ─── OnlineProvidersPanel ─────────────────────────────────────────────────────
// Shown after the customer submits in「主动联系上线商家」(self_contact) mode.
// Lists providers who offer the requested category AND are currently online接单
// (is_online) as a 名片墙 — the customer reaches out directly (站内私信 or 主页).
// No dispatch/notification is sent to providers in this mode; it's pull, not push.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, ExternalLink, MessageCircle, MapPin, BadgeCheck, Shield, CheckCircle, Radio } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { toast } from '../../lib/toast'
import { calcDistance } from '../../lib/geo'

interface ProviderCard {
  id: string
  name: string
  avatar_url: string | null
  avgRating: number
  reviewCount: number
  businessType: 'individual' | 'business'
  distanceKm: number | null
  hasLicense: boolean
  hasInsurance: boolean
  orderCount: number
}

interface Props {
  categoryId:    string
  categoryLabel: string
  customerLoc:   { lat: number; lng: number } | null
  onClose: () => void
}

export default function OnlineProvidersPanel({ categoryId, categoryLabel, customerLoc, onClose }: Props) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [providers, setProviders] = useState<ProviderCard[]>([])
  const [loading, setLoading] = useState(true)
  const [chatting, setChatting] = useState<string | null>(null)
  const fetched = useRef(false)

  useEffect(() => {
    if (fetched.current) return
    fetched.current = true

    const run = async () => {
      // Providers offering this category, whose account is online接单 right now.
      const { data: rows } = await supabase
        .from('services')
        .select('provider_id, provider:provider_id(id, name, avatar_url, is_online, online_lat, online_lng, business_type, has_license, has_insurance)')
        .eq('category_id', categoryId)
        .eq('is_available', true)

      const byId = new Map<string, any>()
      for (const row of (rows ?? []) as any[]) {
        const p = Array.isArray(row.provider) ? row.provider[0] : row.provider
        if (!p || p.is_online !== true || p.id === user?.id) continue
        if (!byId.has(p.id)) byId.set(p.id, p)
      }
      const ids = Array.from(byId.keys())
      if (ids.length === 0) { setProviders([]); setLoading(false); return }

      const [{ data: reviews }, orderCounts] = await Promise.all([
        supabase.from('reviews').select('provider_id, rating').in('provider_id', ids),
        Promise.all(ids.map(pid =>
          supabase.rpc('provider_order_count', { p_provider: pid }).then(({ data }) => ({ pid, count: (data as number) ?? 0 }))
        )),
      ])

      const ratingMap: Record<string, { sum: number; count: number }> = {}
      for (const r of (reviews ?? []) as { provider_id: string; rating: number }[]) {
        if (!ratingMap[r.provider_id]) ratingMap[r.provider_id] = { sum: 0, count: 0 }
        ratingMap[r.provider_id].sum += r.rating
        ratingMap[r.provider_id].count += 1
      }
      const orderCountMap: Record<string, number> = {}
      for (const oc of orderCounts) orderCountMap[oc.pid] = oc.count

      const cards: ProviderCard[] = ids.map((id) => {
        const u = byId.get(id)
        const hasCoords = customerLoc && u.online_lat != null && u.online_lng != null
        return {
          id,
          name: u.name ?? '服务商',
          avatar_url: u.avatar_url ?? null,
          avgRating: ratingMap[id] ? ratingMap[id].sum / ratingMap[id].count : 0,
          reviewCount: ratingMap[id]?.count ?? 0,
          businessType: (u.business_type ?? 'individual') as 'individual' | 'business',
          distanceKm: hasCoords ? calcDistance(customerLoc!.lat, customerLoc!.lng, u.online_lat, u.online_lng) : null,
          hasLicense: !!u.has_license,
          hasInsurance: !!u.has_insurance,
          orderCount: orderCountMap[id] ?? 0,
        }
      })
      cards.sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return b.avgRating - a.avgRating
        if (a.distanceKm == null) return 1
        if (b.distanceKm == null) return -1
        return a.distanceKm - b.distanceKm
      })
      setProviders(cards)
      setLoading(false)
    }

    run()
  }, [categoryId, customerLoc, user])

  async function startChat(providerId: string) {
    if (!user) { navigate('/login'); return }
    if (providerId === user.id) return
    setChatting(providerId)
    const { data, error } = await supabase
      .from('conversations')
      .upsert({ client_id: user.id, provider_id: providerId, service_id: null },
               { onConflict: 'client_id,provider_id,service_id', ignoreDuplicates: false })
      .select('id')
      .single()
    if (error || !data) { setChatting(null); toast('发起对话失败，请稍后再试', 'error'); return }
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', data.id)
    if (!count) {
      const opener = `你好，我通过华邻发布了「${categoryLabel}」需求，看到你在线接单，想咨询一下～`
      await supabase.from('messages').insert({ conversation_id: data.id, sender_id: user.id, content: opener })
      await supabase.from('conversations')
        .update({ last_message: opener, last_message_at: new Date().toISOString() })
        .eq('id', data.id)
      await supabase.rpc('increment_conversation_unread', { conv_id: data.id, col_name: 'provider_unread' })
    }
    onClose()
    navigate(`/conversation/${data.id}`)
  }

  return (
    <div className="px-5 py-5 space-y-4">
      <div className="rounded-2xl p-4 flex items-center gap-3 bg-emerald-50 border border-emerald-100">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-100">
          <Radio size={20} className="text-emerald-600 animate-pulse" />
        </div>
        <div>
          <p className="text-sm font-bold text-emerald-700">
            {loading ? '正在查找在线商家…' : `${providers.length} 位商家正在线接单`}
          </p>
          <p className="text-xs mt-0.5 text-emerald-600">{categoryLabel} · 点下方直接联系 TA</p>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center py-8 text-gray-400">
          <span className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm">查找中…</p>
        </div>
      )}

      {!loading && providers.length === 0 && (
        <div className="flex flex-col items-center py-8 text-center text-gray-400">
          <Radio size={28} className="mb-3 opacity-40" />
          <p className="text-sm">当前没有该类别的在线商家</p>
          <p className="text-xs text-gray-300 mt-1">你的需求已记录，可关闭后等商家联系，或改用「让商家联系我」</p>
        </div>
      )}

      {providers.map((p, i) => (
        <motion.div key={p.id}
          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm"
        >
          <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 border border-gray-100 bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold">
            {p.avatar_url ? (
              <img loading="lazy" src={p.avatar_url} alt={p.name}
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ) : p.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium text-emerald-700 bg-emerald-50 border border-emerald-200">在线</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {p.reviewCount > 0 ? (
                <span className="text-xs text-yellow-500 flex items-center gap-0.5">
                  <Star size={10} className="fill-yellow-400" />
                  {p.avgRating.toFixed(1)}
                  <span className="text-gray-400 ml-0.5">({p.reviewCount})</span>
                </span>
              ) : (
                <span className="text-xs text-gray-400">暂无评价</span>
              )}
              {p.orderCount > 0 && (
                <span className="text-xs text-gray-500 flex items-center gap-0.5">
                  <CheckCircle size={10} className="text-emerald-400" /> 已成交 {p.orderCount} 单
                </span>
              )}
              {p.distanceKm != null && (
                <span className="text-xs text-gray-500 flex items-center gap-0.5">
                  <MapPin size={10} className="text-gray-400" />
                  {p.distanceKm < 1 ? '<1' : p.distanceKm.toFixed(1)} km
                </span>
              )}
              {p.hasLicense && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-green-700 bg-green-50 border border-green-200 flex items-center gap-0.5">
                  <BadgeCheck size={10} /> 持牌
                </span>
              )}
              {p.hasInsurance && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-blue-700 bg-blue-50 border border-blue-200 flex items-center gap-0.5">
                  <Shield size={10} /> 保险
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <button
              onClick={() => { onClose(); navigate(`/provider/${p.id}`) }}
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:underline"
            >
              <ExternalLink size={10} /> 主页
            </button>
            <button
              onClick={() => startChat(p.id)}
              disabled={chatting === p.id}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl
                         bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50
                         transition-colors active:scale-95"
            >
              {chatting === p.id
                ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><MessageCircle size={12} /> 联系</>}
            </button>
          </div>
        </motion.div>
      ))}

      <button onClick={onClose}
        className="w-full py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
        关闭
      </button>
    </div>
  )
}
