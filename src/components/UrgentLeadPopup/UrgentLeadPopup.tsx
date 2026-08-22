// ─── UrgentLeadPopup ──────────────────────────────────────────────────────────
// 在线接单的商家收到「匹配的客户需求」时,在【当前所在页面】顶部滑下一张卡片,
// 显示单的简述(类目 / 📍位置 / 标题),并给两个动作:
//   · 忽略 → 关闭并记为已读(需求列表里标灰,不再打扰)
//   · 接单 → 直接与客户开聊(get_or_create_conversation → 对话页)
// 紧急单红色强提醒(三连音),普通需求蓝色温和版。数据来自 useUrgentAlertStore +
// useUrgentRequestAlerts(紧急) / useRequestMatchAlerts(普通)。超时自动消失。
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Siren, X, MapPin, MessageSquare } from 'lucide-react'
import { useUrgentAlertStore } from '../../store/urgentAlertStore'
import { useAuthStore } from '../../store/authStore'
import { useReadStore } from '../../store/readStore'
import { supabase } from '../../lib/supabase'
import { toast } from '../../lib/toast'
import { getCategoryById } from '../../data/categories'
import type { ServiceCategory } from '../../types'

export default function UrgentLeadPopup() {
  const navigate = useNavigate()
  const user     = useAuthStore(s => s.user)
  const alert    = useUrgentAlertStore(s => s.alert)
  const clear    = useUrgentAlertStore(s => s.clear)
  const markRead = useReadStore(s => s.markRead)

  // 自动消失:紧急单 40s,普通单 25s
  useEffect(() => {
    if (!alert) return
    const t = setTimeout(clear, alert.isUrgent ? 40_000 : 25_000)
    return () => clearTimeout(t)
  }, [alert, clear])

  const cat    = alert?.category ? getCategoryById(alert.category as ServiceCategory) : null
  const urgent = alert?.isUrgent === true

  // 忽略:关闭 + 记已读(列表里标灰,不再弹这条)
  function ignore() {
    if (alert) markRead('request', alert.id)
    clear()
  }

  // 接单:直接与客户开聊
  async function accept() {
    if (!alert) return
    const target = alert
    clear()
    if (!user) { navigate('/login'); return }
    const { data: ok } = await supabase.rpc('can_participate', { p_user: user.id })
    if (ok === false) {
      toast('您的账号因多次有效投诉被暂停接单，请先处理纠纷或联系客服', 'error')
      return
    }
    const { data, error } = await supabase.rpc('get_or_create_conversation', {
      p_provider_id: user.id,        // 当前商家
      p_client_id:   target.posterId, // 发需求的客户
      p_service_id:  null,
    })
    if (error || !data) { toast('无法发起会话，请稍后再试', 'error'); return }
    markRead('request', target.id)
    navigate(`/conversation/${data}`)
  }

  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          key={alert.id}
          initial={{ y: -120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className={`fixed top-3 inset-x-3 md:inset-x-auto md:right-5 md:w-96 z-[80]
                     bg-white rounded-2xl shadow-2xl overflow-hidden border
                     ${urgent ? 'border-red-200' : 'border-primary-200'}`}
          style={{ boxShadow: urgent
            ? '0 12px 40px rgba(220,38,38,0.30)'
            : '0 12px 40px rgba(37,99,235,0.20)' }}
        >
          {/* 顶部条:紧急红 / 普通蓝 */}
          <div className={`flex items-center gap-2 px-4 py-2.5 ${
            urgent ? 'bg-gradient-to-r from-red-600 to-rose-600'
                   : 'bg-gradient-to-r from-primary-600 to-indigo-600'}`}>
            <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              {urgent
                ? <Siren size={16} className="text-white animate-pulse" />
                : <MessageSquare size={15} className="text-white" />}
            </span>
            <p className="text-sm font-bold text-white flex-1">
              {urgent ? '🚨 新紧急单！客户急需服务' : '💼 有新需求匹配你'}
            </p>
            <button onClick={ignore}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 text-white/80">
              <X size={15} />
            </button>
          </div>

          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-1.5">
              {cat && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                  urgent ? 'bg-red-50 text-red-600 border-red-100'
                         : 'bg-primary-50 text-primary-600 border-primary-100'}`}>
                  {cat.emoji} {cat.label}
                </span>
              )}
              {alert.area && (
                <span className="text-[11px] text-gray-500 flex items-center gap-0.5">
                  <MapPin size={11} className="text-gray-400" /> {alert.area}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-800 font-medium leading-snug line-clamp-2">{alert.title}</p>

            {/* 两个动作:忽略 / 接单 */}
            <div className="flex gap-2 pt-1">
              <button onClick={ignore}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold
                           hover:bg-gray-50 transition-colors active:scale-95">
                忽略
              </button>
              <button onClick={accept}
                className={`flex-[1.6] flex items-center justify-center gap-1.5 text-white text-sm font-bold
                           py-2.5 rounded-xl transition-colors active:scale-95 ${
                  urgent ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'}`}>
                <MessageSquare size={15} /> 接单 · 联系客户
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
