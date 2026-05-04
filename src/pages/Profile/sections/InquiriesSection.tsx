// ─── My Inquiries Section (我的报价请求) ──────────────────────────────────────
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { CATEGORIES } from '../../../data/categories'

interface InquiryMatch {
  provider_name: string
  created_at: string
}

interface Inquiry {
  id: string
  category_id: string
  description: string
  budget: string | null
  timing: string
  status: 'open' | 'matched' | 'closed'
  created_at: string
  matches: InquiryMatch[]
}

const STATUS_CONFIG = {
  open:    { label: '待匹配', color: 'bg-amber-100 text-amber-700' },
  matched: { label: '已匹配', color: 'bg-blue-100 text-blue-700' },
  closed:  { label: '已完成', color: 'bg-gray-100 text-gray-500' },
} satisfies Record<Inquiry['status'], { label: string; color: string }>

const TIMING_LABEL: Record<string, string> = {
  asap:      '尽快',
  flexible:  '时间灵活',
  next_week: '下周',
}

export default function InquiriesSection() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const [items,   setItems]   = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    if (!user) {
      setItems([])
      setLoading(false)
      return undefined
    }
    const userId = user.id
    async function loadInquiries() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('inquiries')
          .select('id, category_id, description, budget, timing, status, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (error) {
          console.warn('[inquiries] load failed:', error)
          if (isActive) {
            setItems([])
            setLoading(false)
          }
          return
        }
        if (!data || data.length === 0) {
          if (isActive) {
            setItems([])
            setLoading(false)
          }
          return
        }

        // Fetch matches for each inquiry in parallel
        const withMatches = await Promise.all(
          data.map(async (row: any) => {
            const { data: matchData } = await supabase
              .from('inquiry_matches')
              .select('provider_name, created_at')
              .eq('inquiry_id', row.id)
              .order('created_at', { ascending: false })
            return { ...row, matches: matchData ?? [] } as Inquiry
          })
        )
        if (isActive) setItems(withMatches)
      } catch (err) {
        console.warn('[inquiries] load failed:', err)
        if (isActive) setItems([])
      } finally {
        if (isActive) setLoading(false)
      }
    }

    void loadInquiries()
    return () => { isActive = false }
  }, [user])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm py-20">加载中…</div>
  )

  return (
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
              const cat = CATEGORIES.find(c => c.id === item.category_id)
              const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.open
              const isOpen = expanded === item.id
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

                          {item.matches.length > 0 ? (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                                <Sparkles size={11} className="text-primary-500" />
                                已匹配 {item.matches.length} 位服务商
                              </p>
                              <div className="space-y-1">
                                {item.matches.map((m, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2">
                                    <span className="font-medium">{m.provider_name}</span>
                                    <span className="text-gray-400">{m.created_at.slice(0, 10)}</span>
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-gray-400 mt-2">平台已向以上服务商发送您的联系方式，请等待他们主动联系</p>
                            </div>
                          ) : (
                            <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                              正在为您匹配合适的服务商，请留意电话和微信消息
                            </p>
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
