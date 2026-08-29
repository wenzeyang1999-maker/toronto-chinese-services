// ─── PromoBanner ──────────────────────────────────────────────────────────────
// 常驻招商广告条:刺激服务商注册(黄金会员限时赠送)。长期显示,不可关闭。
// 已登录用户不再展示(已入驻,无需再劝注册)。
import { useNavigate } from 'react-router-dom'
import { Gift, ArrowRight } from 'lucide-react'
import { useAuthStore } from '../../../store/authStore'

export default function PromoBanner() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  if (user) return null

  return (
    <button
      onClick={() => navigate('/register')}
      className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left shadow-sm
                 bg-gradient-to-r from-amber-500 to-orange-500 text-white
                 hover:from-amber-600 hover:to-orange-600 transition-colors active:scale-[0.99]"
    >
      <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
        <Gift size={20} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-snug">10月1日前入驻，免费送黄金会员 3 个月 🎉</p>
        <p className="text-xs text-white/85 mt-0.5">服务商限时福利 · 名额有限，立即注册入驻</p>
      </div>
      <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold bg-white text-orange-600 rounded-full px-3 py-1.5">
        立即入驻 <ArrowRight size={13} />
      </span>
    </button>
  )
}
