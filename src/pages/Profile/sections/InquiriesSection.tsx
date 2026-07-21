// ─── My Inquiries Section (客户侧) ────────────────────────────────────────────
// Shows inquiries the current user submitted, with live race/selection state.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, ChevronDown, ChevronUp, Users, CheckCircle, Clock, X, Star, MessageCircle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useAppStore } from '../../../store/appStore'
import { toast } from '../../../lib/toast'
import { CATEGORIES } from '../../../data/categories'
import InquiryResultPanel from '../../../components/InquiryResultPanel/InquiryResultPanel'
import Badge from '../../../components/Badge/Badge'

interface Inquiry {
  id: string
  category_id: string
  description: string
  budget: string | null
  timing: string
  status: 'open' | 'matched' | 'closed'
  race_status: string | null
  accepted_provider_ids: string[]
  assigned_provider_id: string | null
  name: string
  phone: string
  wechat: string | null
  created_at: string
}

const STATUS_CONFIG = {
  open:    { label: '待接单', tone: 'warning' },
  matched: { label: '已选定', tone: 'success' },
  closed:  { label: '已关闭', tone: 'neutral' },
} satisfies Record<Inquiry['status'], { label: string; tone: 'warning' | 'success' | 'neutral' }>

const TIMING_LABEL: Record<string, string> = {
  asap:      '尽快',
  flexible:  '时间灵活',
  next_week: '下周',
}

interface ActivePanel {
  id: string
  categoryId: string
  categoryLabel: string
  name: string
  phone: string
  wechat: string
}

// A public demand posted via the「发需求」flow (PostRequest). It only writes a
// service_requests row — no inquiry, no 5-provider race — so it never showed up
// in「我的交易」before. We list these alongside inquiries (excluding the ones
// that DO have a linked inquiry, which already appear as 报价请求).
interface DemandRequest {
  id: string
  category: string
  title: string
  description: string | null
  budget: string | null
  status: 'open' | 'closed'
  created_at: string
}

type Row =
  | ({ kind: 'inquiry' } & Inquiry)
  | ({ kind: 'request' } & DemandRequest)

export default function InquiriesSection() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const [items,       setItems]       = useState<Row[]>([])
  const [loading,     setLoading]     = useState(true)
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null)

  useEffect(() => {
    let isActive = true
    if (!user) { setItems([]); setLoading(false); return undefined }
    const userId = user.id

    async function load() {
      setLoading(true)
      const [inqRes, reqRes] = await Promise.all([
        supabase
          .from('inquiries')
          .select('id, category_id, description, budget, timing, status, race_status, accepted_provider_ids, assigned_provider_id, name, phone, wechat, created_at')
          .eq('user_id', userId)
          .neq('status', 'closed')   // hide closed — mirror the map (closed = gone)
          .order('created_at', { ascending: false }),
        // 「发需求」posts have no linked inquiry — pull those so they show here too.
        supabase
          .from('service_requests')
          .select('id, category, title, description, budget, status, created_at')
          .eq('user_id', userId)
          .is('inquiry_id', null)
          .neq('status', 'closed')
          .order('created_at', { ascending: false }),
      ])

      if (!isActive) return

      const inquiries: Row[] = (inqRes.data ?? []).map((r: any) => ({
        kind: 'inquiry',
        ...r,
        accepted_provider_ids: r.accepted_provider_ids ?? [],
      }))
      const requests: Row[] = (reqRes.data ?? []).map((r: any) => ({
        kind: 'request',
        ...r,
      }))
      // Merge and sort newest-first across both kinds (ISO strings sort chronologically).
      setItems([...inquiries, ...requests].sort((a, b) => b.created_at.localeCompare(a.created_at)))
      setLoading(false)
    }

    void load()
    return () => { isActive = false }
  }, [user])

  async function closeInquiry(id: string) {
    if (!user) return
    const item = items.find(it => it.id === id)
    const { error } = await supabase.from('inquiries')
      .update({ status: 'closed' }).eq('id', id).eq('user_id', user.id)
    if (error) { toast('关闭失败，请重试', 'error'); return }
    // Closed = gone: drop it from the list so it mirrors the map (no lingering).
    setItems(prev => prev.filter(it => it.id !== id))

    // Cascade to the public demand post so its map pin disappears too.
    // 1) Linked posts (new data) — close by inquiry_id.
    await supabase.from('service_requests')
      .update({ status: 'closed', lat: null, lng: null })
      .eq('inquiry_id', id).eq('user_id', user.id)
    // 2) Legacy posts with no link — match by same user + category + a ±2 min
    //    window around this inquiry's creation (both rows are written in the same
    //    submit, so their timestamps are within seconds). Guarantees old data
    //    cascades too, no manual SQL needed.
    if (item && item.kind === 'inquiry') {
      const t  = new Date(item.created_at).getTime()
      const lo = new Date(t - 120_000).toISOString()
      const hi = new Date(t + 120_000).toISOString()
      await supabase.from('service_requests')
        .update({ status: 'closed', lat: null, lng: null })
        .eq('user_id', user.id)
        .eq('category', item.category_id)
        .is('inquiry_id', null)
        .eq('status', 'open')
        .gte('created_at', lo)
        .lte('created_at', hi)
    }
    void useAppStore.getState().fetchServiceRequests()
  }

  async function closeRequest(id: string) {
    if (!user) return
    // Wipe coords too so the demand pin drops off the map (map filters null lat/lng).
    const { error } = await supabase.from('service_requests')
      .update({ status: 'closed', lat: null, lng: null }).eq('id', id).eq('user_id', user.id)
    if (error) { toast('关闭失败，请重试', 'error'); return }
    setItems(prev => prev.filter(it => it.id !== id))
    void useAppStore.getState().fetchServiceRequests()
  }

  if (loading) return (
    <div className="flex-1 space-y-3 p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-3/4 mb-3" />
          <div className="h-3 bg-gray-100 rounded w-1/2 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
      ))}
    </div>
  )

  return (
    <>
      <motion.div
        key="inquiries"
        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}
        className="flex-1 px-4 py-6 max-w-md lg:max-w-none mx-auto w-full"
      >
        {items.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center">
            <ClipboardList size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-600 font-medium">还没有报价请求</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">点击首页的"AI帮你找"提交需求，平台自动匹配服务商</p>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-2xl hover:bg-primary-700 transition-colors"
            >
              去提交需求
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 px-1">共 {items.length} 条</p>
            <AnimatePresence>
              {items.map((item, i) => {
                const catId   = item.kind === 'inquiry' ? item.category_id : item.category
                const cat     = CATEGORIES.find(c => c.id === catId)
                const isOpen  = expanded === item.id

                // ── 我发布的公开需求（「发需求」入口，无抢单流程）──
                if (item.kind === 'request') {
                  return (
                    <motion.div key={item.id}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                    >
                      <button
                        onClick={() => setExpanded(isOpen ? null : item.id)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-xl flex-shrink-0">{cat?.emoji ?? '📌'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {item.title || cat?.label || '我的需求'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {item.created_at.slice(0, 10)} · 我发布的需求
                            {item.budget ? ` · 预算 ${item.budget}` : ''}
                          </p>
                        </div>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${item.status === 'closed' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>
                          {item.status === 'closed' ? '已关闭' : '招募中'}
                        </span>
                        {isOpen ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
                              {item.description && (
                                <p className="text-sm text-gray-700 leading-relaxed">{item.description}</p>
                              )}
                              <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                                <MessageCircle size={14} className="text-blue-500 flex-shrink-0" />
                                <p className="text-xs text-blue-700">这是公开需求帖，商家看到后会通过站内消息私信你</p>
                              </div>
                              <button
                                onClick={() => navigate('/profile?section=messages')}
                                className="w-full flex items-center justify-center gap-1.5 bg-primary-600 hover:bg-primary-700
                                           text-white text-sm font-semibold py-2.5 rounded-xl transition-colors active:scale-95"
                              >
                                <MessageCircle size={14} /> 去「我的消息」看商家私信 →
                              </button>
                              <button
                                onClick={() => navigate(`/requests/${item.id}`)}
                                className="w-full flex items-center justify-center gap-1.5 bg-white border border-gray-200
                                           rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors text-xs font-semibold text-gray-700"
                              >
                                查看公开需求页 →
                              </button>
                              {item.status !== 'closed' && (
                                <button
                                  onClick={() => closeRequest(item.id)}
                                  className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400
                                             hover:text-red-500 py-1.5 transition-colors"
                                >
                                  <X size={13} /> 关闭此需求（已找到服务商）
                                </button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                }

                // ── 报价请求（AI 发单，带 5 人抢单状态）──
                const cfg     = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.open
                const slotFilled = item.accepted_provider_ids.length >= 5 || item.race_status === 'filled'
                const hasProviders = item.accepted_provider_ids.length > 0
                const isAssigned = !!item.assigned_provider_id

                return (
                  <motion.div key={item.id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    {/* Header row */}
                    <button
                      onClick={() => setExpanded(isOpen ? null : item.id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-xl flex-shrink-0">{cat?.emoji ?? '✦'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {cat?.label ?? item.category_id}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.created_at.slice(0, 10)} · {TIMING_LABEL[item.timing] ?? item.timing}
                          {item.budget ? ` · 预算 ${item.budget}` : ''}
                        </p>
                      </div>
                      <Badge tone={cfg.tone} className="flex-shrink-0">{cfg.label}</Badge>
                      {isOpen ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
                    </button>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
                            <p className="text-sm text-gray-700 leading-relaxed">{item.description}</p>

                            {/* Race state */}
                            {isAssigned ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                                  <CheckCircle size={15} className="text-green-500 flex-shrink-0" />
                                  <p className="text-xs font-semibold text-green-700">您已选定服务商，对方将主动联系您</p>
                                </div>
                                <button
                                  onClick={() => navigate(`/provider/${item.assigned_provider_id}`)}
                                  className="w-full flex items-center justify-center gap-1.5 bg-white border border-gray-200
                                             rounded-xl px-3 py-2.5 hover:bg-amber-50 hover:border-amber-200 transition-colors"
                                >
                                  <Star size={14} className="text-amber-500 flex-shrink-0" />
                                  <span className="text-xs font-semibold text-gray-700">服务完成后，去评价这位服务商 →</span>
                                </button>
                              </div>
                            ) : hasProviders ? (
                              <button
                                onClick={() => {
                                  const label = cat ? `${cat.emoji} ${cat.label}` : item.category_id
                                  setActivePanel({
                                    id:            item.id,
                                    categoryId:    item.category_id,
                                    categoryLabel: label,
                                    name:          item.name,
                                    phone:         item.phone,
                                    wechat:        item.wechat ?? '',
                                  })
                                }}
                                className="w-full flex items-center gap-2 bg-primary-50 border border-primary-200
                                           rounded-xl px-3 py-2.5 hover:bg-primary-100 transition-colors text-left"
                              >
                                <Users size={15} className="text-primary-500 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-xs font-bold text-primary-700">
                                    {item.accepted_provider_ids.length} 位服务商已接单
                                    {slotFilled ? '（已满）' : ' · 还可接单'}
                                  </p>
                                  <p className="text-[11px] text-primary-500">点击查看并选择服务商 →</p>
                                </div>
                              </button>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 bg-primary-50 border border-primary-100 rounded-xl px-3 py-2.5">
                                  <MessageCircle size={14} className="text-primary-500 flex-shrink-0" />
                                  <p className="text-xs text-primary-700">商家会通过站内消息联系你，请留意「我的消息」（你的电话/微信不会自动透露）</p>
                                </div>
                                <button
                                  onClick={() => navigate('/profile?section=messages')}
                                  className="w-full flex items-center justify-center gap-1.5 bg-primary-600 hover:bg-primary-700
                                             text-white text-sm font-semibold py-2.5 rounded-xl transition-colors active:scale-95"
                                >
                                  <MessageCircle size={14} /> 去「我的消息」看商家私信 →
                                </button>
                              </div>
                            )}

                            {/* Let the user close an unresolved request they no longer need */}
                            {item.status !== 'closed' && !isAssigned && (
                              <button
                                onClick={() => closeInquiry(item.id)}
                                className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400
                                           hover:text-red-500 py-1.5 transition-colors"
                              >
                                <X size={13} /> 关闭此请求
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* InquiryResultPanel bottom sheet */}
      <AnimatePresence>
        {activePanel && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setActivePanel(null)}
              className="fixed inset-0 bg-black/40 z-[50]"
            />
            <motion.div
              key="panel"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              className="fixed bottom-0 left-0 right-0 z-[51] bg-white rounded-t-3xl shadow-2xl flex flex-col"
              style={{ maxHeight: '90vh' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 flex-shrink-0">
                <span className="text-sm font-semibold text-gray-600">选择服务商</span>
                <button onClick={() => setActivePanel(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain">
                <InquiryResultPanel
                  inquiryId={activePanel.id}
                  categoryId={activePanel.categoryId}
                  categoryLabel={activePanel.categoryLabel}
                  customerName={activePanel.name}
                  customerPhone={activePanel.phone}
                  customerWechat={activePanel.wechat}
                  onClose={() => setActivePanel(null)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
