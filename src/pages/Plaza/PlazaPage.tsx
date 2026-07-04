// ─── Plaza Page (大多广场) ──────────────────────────────────────────────────────
// Route: /plaza
// A launcher hub, NOT a duplicate feed. 社区圈子 and 同城活动 now live in their
// own canonical pages (/community, /events) which carry the full feature set
// (关注 / 排序 / RSVP / 抽屉). Plaza just fans out to them + previews what's coming.
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MessageSquareText, CalendarDays, Store, HeartHandshake, ChevronRight } from 'lucide-react'
import Header from '../../components/Header/Header'
import PageMeta from '../../components/PageMeta/PageMeta'

const TILES = [
  { label: '社区圈子', sub: '求推荐 · 经验分享 · 问答 · 转让', to: '/community', icon: MessageSquareText, color: 'from-rose-400 to-pink-500', live: true },
  { label: '同城活动', sub: '聚会 · 课程 · 讲座 · 演出,可在线报名', to: '/events', icon: CalendarDays, color: 'from-violet-400 to-purple-500', live: true },
  { label: '集市摊位', sub: '摆摊 · 快闪 · 市集(即将上线)', to: null, icon: Store, color: 'from-amber-400 to-orange-500', live: false },
  { label: '公益慈善', sub: '志愿 · 募捐 · 互助(即将上线)', to: null, icon: HeartHandshake, color: 'from-emerald-400 to-teal-500', live: false },
]

export default function PlazaPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <PageMeta title="大多广场 — 华邻" description="华人社区圈子、同城活动、集市与公益,尽在华邻大多广场。" />
      <Header />

      <div className="w-full px-4 md:w-[85%] md:px-0 lg:w-[70%] mx-auto pt-5">
        <h1 className="text-xl font-bold text-gray-900 mb-1">大多广场</h1>
        <p className="text-sm text-gray-400 mb-5">社区、活动、集市、公益 · 一站入口</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TILES.map((t, i) => {
            const Icon = t.icon
            return (
              <motion.button
                key={t.label}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => t.to && navigate(t.to)}
                disabled={!t.live}
                className={`relative flex items-center gap-4 rounded-3xl p-5 text-left overflow-hidden transition-all
                  ${t.live ? 'bg-white shadow-sm hover:shadow-md active:scale-[0.98] cursor-pointer' : 'bg-white/60 cursor-not-allowed'}`}
              >
                <span className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${t.color} flex items-center justify-center text-white flex-shrink-0 ${!t.live && 'opacity-50'}`}>
                  <Icon size={26} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-bold ${t.live ? 'text-gray-900' : 'text-gray-400'}`}>{t.label}</p>
                    {!t.live && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">即将上线</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{t.sub}</p>
                </div>
                {t.live && <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />}
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
