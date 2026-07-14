// ─── InquiryResultPanel ───────────────────────────────────────────────────────
// Shown after customer submits an inquiry.
// Live-updates as providers claim "抢单" slots.
// Customer picks one; the inquiry is then marked matched + assigned.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Star, ExternalLink, Zap, Clock, Users, Phone, MessageCircle, Copy, Check, MapPin, BadgeCheck, Shield } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { notifyInquirySelected } from '../../lib/notify'
import { toast } from '../../lib/toast'
import { calcDistance } from '../../lib/geo'

interface ProviderCard {
  id: string
  name: string
  avatar_url: string | null
  avgRating: number
  reviewCount: number
  businessType: 'individual' | 'business'   // 经营主体：自雇 / 公司
  distanceKm: number | null                 // 与发单地点的距离（在线服务商才可算）
  hasLicense: boolean                       // 持牌资质（admin 核验）
  hasInsurance: boolean                     // 商业保险（admin 核验）
}

interface Props {
  inquiryId:     string
  categoryId:    string
  categoryLabel: string
  customerName:  string
  customerPhone: string
  customerWechat: string
  onClose: () => void
}

const MAX_SLOTS = 5

export default function InquiryResultPanel({ inquiryId, categoryId, categoryLabel, customerName, customerPhone, customerWechat, onClose }: Props) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [chatting, setChatting] = useState(false)

  // 询价 → 站内 IM: open (or reuse) a conversation with the chosen provider and
  // seed an opening message so the funnel continues inside the app.
  async function startInquiryChat(providerId: string) {
    if (!user) { navigate('/login'); return }
    if (providerId === user.id) return
    setChatting(true)
    const { data, error } = await supabase
      .from('conversations')
      .upsert({ client_id: user.id, provider_id: providerId, service_id: null },
               { onConflict: 'client_id,provider_id,service_id', ignoreDuplicates: false })
      .select('id')
      .single()
    if (error || !data) { setChatting(false); toast('发起对话失败，请稍后再试', 'error'); return }
    // Seed an opener only on a fresh conversation (avoid duplicates on re-tap).
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', data.id)
    if (!count) {
      const opener = `你好，我通过华邻发起了「${categoryLabel}」询价并选择了你，想进一步沟通～`
      await supabase.from('messages').insert({ conversation_id: data.id, sender_id: user.id, content: opener })
      await supabase.from('conversations')
        .update({ last_message: opener, last_message_at: new Date().toISOString() })
        .eq('id', data.id)
      await supabase.rpc('increment_conversation_unread', { conv_id: data.id, col_name: 'provider_unread' })
    }
    onClose()
    navigate(`/conversation/${data.id}`)
  }

  const [acceptedIds,  setAcceptedIds]  = useState<string[]>([])
  const [raceStatus,   setRaceStatus]   = useState<string>('open')
  const [providers,    setProviders]    = useState<ProviderCard[]>([])
  const [selected,       setSelected]       = useState<string | null>(null)
  const [selecting,      setSelecting]      = useState<string | null>(null)
  const [assignedCard,   setAssignedCard]   = useState<ProviderCard | null>(null)
  const [contactPhone,   setContactPhone]   = useState<string | null>(null)
  const [contactWechat,  setContactWechat]  = useState<string | null>(null)
  const [wechatCopied,   setWechatCopied]   = useState(false)
  const [customerLoc,    setCustomerLoc]    = useState<{ lat: number; lng: number } | null>(null)

  // Fetch initial state
  useEffect(() => {
    supabase
      .from('inquiries')
      .select('accepted_provider_ids, race_status, assigned_provider_id, lat, lng')
      .eq('id', inquiryId)
      .single()
      .then(({ data }) => {
        if (!data) return
        setAcceptedIds((data.accepted_provider_ids as string[]) ?? [])
        setRaceStatus(data.race_status ?? 'open')
        if (data.assigned_provider_id) setSelected(data.assigned_provider_id as string)
        if (data.lat != null && data.lng != null) setCustomerLoc({ lat: data.lat as number, lng: data.lng as number })
      })
  }, [inquiryId])

  // Realtime: subscribe to inquiry UPDATE
  useEffect(() => {
    const channel = supabase
      .channel(`inquiry-result-${inquiryId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'inquiries',
        filter: `id=eq.${inquiryId}`,
      }, (payload) => {
        const row = payload.new as any
        setAcceptedIds((row.accepted_provider_ids as string[]) ?? [])
        setRaceStatus(row.race_status ?? 'open')
        if (row.assigned_provider_id) setSelected(row.assigned_provider_id as string)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [inquiryId])

  // Fetch provider cards whenever the accepted set — or the customer location
  // (needed for the distance chip) — changes.
  const prevIds = useRef<string>('')
  useEffect(() => {
    const key = acceptedIds.slice().sort().join(',') + '|' + (customerLoc ? 'loc' : 'noloc')
    if (!acceptedIds.length || key === prevIds.current) return
    prevIds.current = key

    const fetchProviders = async () => {
      const [{ data: users }, { data: reviews }] = await Promise.all([
        supabase.from('users').select('id, name, avatar_url, business_type, online_lat, online_lng, has_license, has_insurance').in('id', acceptedIds),
        supabase.from('reviews').select('provider_id, rating').in('provider_id', acceptedIds),
      ])

      const ratingMap: Record<string, { sum: number; count: number }> = {}
      for (const r of (reviews ?? []) as { provider_id: string; rating: number }[]) {
        if (!ratingMap[r.provider_id]) ratingMap[r.provider_id] = { sum: 0, count: 0 }
        ratingMap[r.provider_id].sum   += r.rating
        ratingMap[r.provider_id].count += 1
      }

      const cards: ProviderCard[] = (users ?? []).map((u: any) => {
        const hasCoords = customerLoc && u.online_lat != null && u.online_lng != null
        return {
          id:          u.id,
          name:        u.name ?? '服务商',
          avatar_url:  u.avatar_url ?? null,
          avgRating:   ratingMap[u.id] ? ratingMap[u.id].sum / ratingMap[u.id].count : 0,
          reviewCount: ratingMap[u.id]?.count ?? 0,
          businessType: (u.business_type ?? 'individual') as 'individual' | 'business',
          distanceKm:  hasCoords ? calcDistance(customerLoc!.lat, customerLoc!.lng, u.online_lat, u.online_lng) : null,
          hasLicense:   !!u.has_license,
          hasInsurance: !!u.has_insurance,
        }
      })

      // Nearest first; providers without a known distance keep the accept order
      // and sink to the bottom.
      cards.sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return acceptedIds.indexOf(a.id) - acceptedIds.indexOf(b.id)
        if (a.distanceKm == null) return 1
        if (b.distanceKm == null) return -1
        return a.distanceKm - b.distanceKm
      })
      setProviders(cards)
    }

    fetchProviders()
  }, [acceptedIds, customerLoc])

  // Set assignedCard + fetch contact info once selection known
  useEffect(() => {
    if (!selected) return
    const card = providers.find(p => p.id === selected)
    if (card) setAssignedCard(card)

    supabase
      .from('services')
      .select('phone, wechat')
      .eq('provider_id', selected)
      .eq('category_id', categoryId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setContactPhone((data as any).phone ?? null)
          setContactWechat((data as any).wechat ?? null)
        }
      })
  }, [selected, providers, categoryId])

  async function copyWechat() {
    if (!contactWechat) return
    try {
      await navigator.clipboard.writeText(contactWechat)
      setWechatCopied(true)
      setTimeout(() => setWechatCopied(false), 2000)
    } catch {
      toast(`微信号：${contactWechat}（请手动复制）`)
    }
  }

  async function handleSelect(providerId: string) {
    setSelecting(providerId)
    const { error } = await supabase
      .from('inquiries')
      .update({ assigned_provider_id: providerId, status: 'matched' })
      .eq('id', inquiryId)
    setSelecting(null)
    if (!error) {
      setSelected(providerId)
      // Confirm the action — the view switches instantly, so a toast makes it
      // clear the choice landed and sets the expectation of who contacts whom.
      toast('已选定服务商，已通知对方，TA 会主动联系你 ✓', 'success')
      // Notify the selected provider
      void notifyInquirySelected({
        recipientUserId: providerId,
        customerName:    customerName,
        phone:           customerPhone,
        wechat:          customerWechat,
        categoryLabel,
      })
    } else {
      toast('选择失败，请重试', 'error')
    }
  }

  const filled    = raceStatus === 'filled' || acceptedIds.length >= MAX_SLOTS
  const slotCount = acceptedIds.length

  // ── Assigned (customer already picked) ──────────────────────────────────────
  if (selected && assignedCard) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="px-5 py-6 space-y-4">
        <div className="flex flex-col items-center text-center">
          <CheckCircle size={44} className="text-green-500 mb-3" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">已选择服务商</h3>
          <p className="text-sm text-gray-400">您可以直接联系对方安排服务</p>
        </div>

        {/* Provider card */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border border-gray-100 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold">
            {assignedCard.avatar_url ? (
              <img loading="lazy" src={assignedCard.avatar_url} alt={assignedCard.name}
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ) : assignedCard.name.charAt(0)}
          </div>
          <div className="text-left min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-800 truncate">{assignedCard.name}</p>
            {assignedCard.reviewCount > 0 && (
              <p className="text-xs text-yellow-500 flex items-center gap-0.5">
                <Star size={10} className="fill-yellow-400" />
                {assignedCard.avgRating.toFixed(1)} ({assignedCard.reviewCount} 评价)
              </p>
            )}
            <button onClick={() => { onClose(); navigate(`/provider/${assignedCard.id}`) }}
              className="text-[11px] text-primary-600 flex items-center gap-0.5 mt-0.5 hover:underline">
              <ExternalLink size={10} /> 查看主页
            </button>
          </div>
        </div>

        {/* In-app message — recommended, keeps the conversation in the app */}
        <button
          onClick={() => startInquiryChat(assignedCard.id)}
          disabled={chatting}
          className="flex items-center justify-center gap-2 w-full bg-primary-600 hover:bg-primary-700
                     text-white text-sm font-semibold py-3 rounded-xl transition-colors active:scale-95 disabled:opacity-60"
        >
          <MessageCircle size={15} /> {chatting ? '正在打开…' : '发站内消息'}
        </button>

        {/* Contact info */}
        {(contactPhone || contactWechat) && (
          <div className="space-y-2">
            {contactPhone && (
              <a href={`tel:${contactPhone}`}
                className="flex items-center justify-center gap-2 w-full border border-primary-200 bg-primary-50 hover:bg-primary-100
                           text-primary-700 text-sm font-semibold py-3 rounded-xl transition-colors active:scale-95">
                <Phone size={15} /> {contactPhone}
              </a>
            )}
            {contactWechat && (
              <button onClick={copyWechat}
                className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600
                           text-white text-sm font-semibold py-3 rounded-xl transition-colors active:scale-95">
                {wechatCopied ? <Check size={15} /> : <MessageCircle size={15} />}
                {wechatCopied ? '微信号已复制' : `微信：${contactWechat}`}
              </button>
            )}
          </div>
        )}

        <button onClick={onClose}
          className="w-full py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          关闭
        </button>
      </motion.div>
    )
  }

  // ── Waiting / live race view ─────────────────────────────────────────────────
  return (
    <div className="px-5 py-5 space-y-4">
      {/* Header status */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className={`rounded-2xl p-4 flex items-center gap-3 ${
          filled ? 'bg-green-50 border border-green-200' : 'bg-primary-50 border border-primary-100'
        }`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          filled ? 'bg-green-100' : 'bg-primary-100'
        }`}>
          {filled ? <Users size={20} className="text-green-600" /> : <Zap size={20} className="text-primary-600 animate-pulse" />}
        </div>
        <div>
          <p className={`text-sm font-bold ${filled ? 'text-green-700' : 'text-primary-700'}`}>
            {filled ? '5 名服务商已接单！' : `正在等待服务商接单… ${slotCount}/${MAX_SLOTS}`}
          </p>
          <p className={`text-xs mt-0.5 ${filled ? 'text-green-600' : 'text-primary-500'}`}>
            {filled ? '请从下方选择一位服务商' : '服务商正在抢单，稍后请从下方选择'}
          </p>
        </div>
      </motion.div>

      {/* Slot progress */}
      <div className="flex gap-1.5">
        {Array.from({ length: MAX_SLOTS }).map((_, i) => (
          <div key={i}
            className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
              i < slotCount ? 'bg-primary-500' : 'bg-gray-100'
            }`}
          />
        ))}
      </div>

      {/* Category label */}
      <p className="text-xs text-gray-400 text-center">{categoryLabel}</p>

      {/* Provider cards */}
      <AnimatePresence>
        {providers.length === 0 && (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center py-8 text-gray-400">
            <Clock size={28} className="mb-3 opacity-40 animate-pulse" />
            <p className="text-sm">等待服务商接单中…</p>
            <p className="text-xs text-gray-300 mt-1">通常几分钟内会有人接单</p>
          </motion.div>
        )}
        {providers.map((p, i) => (
          <motion.div key={p.id}
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm"
          >
            <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 border border-gray-100 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold">
              {p.avatar_url ? (
                <img loading="lazy" src={p.avatar_url} alt={p.name}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              ) : p.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  p.businessType === 'business'
                    ? 'text-blue-700 bg-blue-50 border border-blue-200'
                    : 'text-gray-500 bg-gray-100'}`}>
                  {p.businessType === 'business' ? '🏢 公司' : '👤 自雇'}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {p.reviewCount > 0 ? (
                  <span className="text-xs text-yellow-500 flex items-center gap-0.5">
                    <Star size={10} className="fill-yellow-400" />
                    {p.avgRating.toFixed(1)}
                    <span className="text-gray-400 ml-0.5">({p.reviewCount} 评价)</span>
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">暂无评价</span>
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
                className="flex items-center gap-1 text-[11px] text-primary-600 hover:underline"
              >
                <ExternalLink size={10} /> 主页
              </button>
              <button
                onClick={() => handleSelect(p.id)}
                disabled={!!selecting || !!selected}
                className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl
                           bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50
                           transition-colors active:scale-95"
              >
                {selecting === p.id
                  ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : '选择 TA'
                }
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Footer hint */}
      {!filled && (
        <p className="text-center text-xs text-gray-400 pt-2 pb-4">
          您也可以先关闭，服务商会通过您留的联系方式主动联系您
        </p>
      )}
      {!filled && (
        <button onClick={onClose} className="w-full py-2.5 text-sm text-gray-500 border border-gray-200
                                             rounded-xl hover:bg-gray-50 transition-colors">
          关闭，等服务商联系我
        </button>
      )}
    </div>
  )
}
