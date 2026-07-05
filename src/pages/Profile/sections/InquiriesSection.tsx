// ─── My Inquiries Section (客户侧) ────────────────────────────────────────────
// Shows inquiries the current user submitted, with live race/selection state.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, ChevronDown, ChevronUp, Users, CheckCircle, Clock, X, Star } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useAppStore } from '../../../store/appStore'
import { toast } from '../../../lib/toast'
import { CATEGORIES } from '../../../data/categories'
import InquiryResultPanel from '../../../components/InquiryResultPanel/InquiryResultPanel'

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
  open:    { label: '待接单', color: 'bg-amber-100 text-amber-700' },
  matched: { label: '已选定', color: 'bg-green-100 text-green-700' },
  closed:  { label: '已关闭', color: 'bg-gray-100 text-gray-500' },
} satisfies Record<Inquiry['status'], { label: string; color: string }>

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

export default function InquiriesSection() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const [items,       setItems]       = useState<Inquiry[]>([])
  const [loading,     setLoading]     = useState(true)
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null)

  useEffect(() => {
    let isActive = true
    if (!user) { setItems([]); setLoading(false); return undefined }
    const userId = user.id

    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('inquiries')
        .select('id, category_id, description, budget, timing, status, race_status, accepted_provider_ids, assigned_provider_id, name, phone, wechat, created_at')
        .eq('user_id', userId)
        .neq('status', 'closed')   // hide closed — mirror the map (closed = gone)
        .order('created_at', { ascending: false })

      if (isActive) {
        if (!error && data) {
          setItems(data.map((r: any) => ({
            ...r,
            accepted_provider_ids: r.accepted_provider_ids ?? [],
          })))
        }
        setLoading(false)
      }
    }

    void load()
    return () => { isActive = false }
  }, [user])

  async function closeInquiry(id: string) {
    if (!user) return
    const { error } = await supabase.from('inquiries')
      .update({ status: 'closed' }).eq('id', id).eq('user_id', user.id)
    if (error) { toast('关闭失败，请重试', 'error'); return }
    // Closed = gone: drop it from the list so it mirrors the map (no lingering).
    setItems(prev => prev.filter(it => it.id !== id))
    // Cascade to the linked public demand post: close it + drop its map pin,
    // then refresh the in-memory feed so it disappears from 「发现客户」.
    await supabase.from('service_requests')
      .update({ status: 'closed', lat: null, lng: null })
      .eq('inquiry_id', id).eq('user_id', user.id)
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
            <p className="text-xs text-gray-400 px-1">共 {items.length} 条报价请求</p>
            <AnimatePresence>
              {items.map((item, i) => {
                const cat     = CATEGORIES.find(c => c.id === item.category_id)
                const cfg     = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.open
                const isOpen  = expanded === item.id
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
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.color}`}>
                        {cfg.label}
                      </span>
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
                              <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                                <Clock size={14} className="text-amber-500 flex-shrink-0 animate-pulse" />
                                <p className="text-xs text-amber-700">等待服务商接单，请留意电话和微信消息</p>
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
