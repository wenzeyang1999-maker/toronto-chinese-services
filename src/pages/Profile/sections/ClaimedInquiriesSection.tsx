// ─── Claimed Inquiries Section (服务商侧) ─────────────────────────────────────
// Leads dispatched to this provider. 统一「只走站内私信」：商家【绝不】看到客户的
// 电话/微信/精确地址，只能站内私信客户，联系方式由客户在聊天里自行决定是否提供。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Inbox, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { CATEGORIES } from '../../../data/categories'
import { toast } from '../../../lib/toast'

interface ClaimedInquiry {
  id: string
  category_id: string
  description: string
  budget: string | null
  timing: string
  status: 'open' | 'matched' | 'closed'
  assigned_provider_id: string | null
  user_id: string          // 客户 id —— 仅用于发起站内会话，不含任何联系方式
  created_at: string
}

const TIMING_LABEL: Record<string, string> = {
  asap:      '尽快',
  flexible:  '时间灵活',
  next_week: '下周',
}

export default function ClaimedInquiriesSection() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const [items,    setItems]    = useState<ClaimedInquiry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [chatting, setChatting] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    if (!user) { setItems([]); setLoading(false); return undefined }

    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('inquiries')
        .select('id, category_id, description, budget, timing, status, assigned_provider_id, user_id, created_at')
        .contains('accepted_provider_ids', [user!.id])
        .order('created_at', { ascending: false })

      if (isActive) {
        if (!error && data) setItems(data as ClaimedInquiry[])
        setLoading(false)
      }
    }

    void load()
    return () => { isActive = false }
  }, [user])

  // 站内私信客户 —— 唯一的联系通道（get_or_create_conversation 不暴露任何联系方式）
  async function startChat(item: ClaimedInquiry) {
    if (!user || chatting) return
    setChatting(item.id)
    const { data, error } = await supabase.rpc('get_or_create_conversation', {
      p_provider_id: user.id,     // 我（服务商）主动联系
      p_client_id:   item.user_id,
      p_service_id:  null,
    })
    setChatting(null)
    if (error || !data) { toast('无法发起会话，请稍后再试', 'error'); return }
    navigate('/profile?section=messages', { state: { conversationId: data } })
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
    <motion.div
      key="claimed"
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}
      className="flex-1 px-4 py-6 max-w-md lg:max-w-none mx-auto w-full"
    >
      {items.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center">
          <Inbox size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600 font-medium">还没有接过单</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">有客户发布符合你类目的需求时，会以 🔔 通知 + 邮件送达；点开通知里的需求即可<b>站内私信客户</b>。保持「上线接单」能收到更多急单。</p>
          <button
            onClick={() => navigate('/profile?section=homepage')}
            className="px-5 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-2xl hover:bg-primary-700 transition-colors"
          >
            完善我的主页
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 px-1">共 {items.length} 条接单记录</p>
          <AnimatePresence>
            {items.map((item, i) => {
              const cat      = CATEGORIES.find(c => c.id === item.category_id)
              const isOpen   = expanded === item.id
              const selectedMe  = item.assigned_provider_id === user?.id
              const selectedOther = item.assigned_provider_id && item.assigned_provider_id !== user?.id

              let stateBadge: React.ReactNode
              if (selectedMe) {
                stateBadge = (
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0">
                    <CheckCircle2 size={11} /> 已选中我
                  </span>
                )
              } else if (selectedOther) {
                stateBadge = (
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                    <XCircle size={11} /> 已选他人
                  </span>
                )
              } else {
                stateBadge = (
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                    <Clock size={11} /> 待客户选
                  </span>
                )
              }

              return (
                <motion.div key={item.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  {/* Header */}
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
                    {stateBadge}
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

                          {item.status === 'closed' && !selectedMe ? (
                            <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                              <p className="text-xs text-gray-500">该需求已关闭</p>
                            </div>
                          ) : selectedOther ? (
                            <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                              <p className="text-xs text-gray-500">客户已选择其他服务商</p>
                            </div>
                          ) : (
                            <>
                              <button onClick={() => startChat(item)} disabled={chatting === item.id}
                                className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700
                                           text-white text-sm font-semibold py-2.5 rounded-xl transition-colors active:scale-95 disabled:opacity-60">
                                <MessageCircle size={15} />
                                {chatting === item.id ? '正在打开…' : '站内私信客户'}
                              </button>
                              <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                                出于隐私，客户的电话/微信/精确地址不在此显示；请通过站内消息联系，由客户自行决定是否提供。
                              </p>
                            </>
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
  )
}
