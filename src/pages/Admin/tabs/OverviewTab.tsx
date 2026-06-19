// ─── Admin · Overview / stats tab ────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Wrench, Briefcase, Home, ShoppingBag, Calendar, Flag } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { type Stats } from '../types'

interface ConsumerRow { id: string; name: string; email: string; cnt: number }
interface TopConsumers {
  messages: ConsumerRow[]
  requests: ConsumerRow[]
  posts:    ConsumerRow[]
}

interface Props {
  stats: Stats
}

export default function OverviewTab({ stats }: Props) {
  const [trendStats,       setTrendStats]       = useState<Record<string, number> | null>(null)
  const [topConsumers,     setTopConsumers]     = useState<TopConsumers | null>(null)
  const [topConsumersDays, setTopConsumersDays] = useState(1)

  async function loadTopConsumers(days = topConsumersDays) {
    const { data, error } = await supabase.rpc('admin_top_consumers', { p_days: days })
    if (!error && data) setTopConsumers(data as never)
  }

  async function loadTrendStats() {
    const { data, error } = await supabase.rpc('admin_stats_trend')
    if (!error && data) setTrendStats(data as Record<string, number>)
  }

  useEffect(() => {
    if (!trendStats) void loadTrendStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { icon: <Users size={20} />,       label: '注册用户',   value: stats.users,           color: 'text-blue-600 bg-blue-50',      tKey: 'users' },
          { icon: <Wrench size={20} />,       label: '服务',       value: stats.services,        color: 'text-primary-600 bg-primary-50', tKey: 'services' },
          { icon: <Briefcase size={20} />,    label: '招聘职位',   value: stats.jobs,            color: 'text-purple-600 bg-purple-50',  tKey: 'jobs' },
          { icon: <Home size={20} />,         label: '房源',       value: stats.properties,      color: 'text-green-600 bg-green-50',    tKey: 'properties' },
          { icon: <ShoppingBag size={20} />,  label: '闲置',       value: stats.secondhand,      color: 'text-orange-600 bg-orange-50',  tKey: 'secondhand' },
          { icon: <Calendar size={20} />,     label: '活动',       value: stats.events,          color: 'text-pink-600 bg-pink-50',      tKey: 'events' },
          { icon: <Flag size={20} />,         label: '待处理举报', value: stats.pending_reports,          color: 'text-red-600 bg-red-50',    tKey: null },
          { icon: <Flag size={20} />,         label: '内容举报',   value: stats.pending_content_reports,  color: 'text-orange-600 bg-orange-50', tKey: null },
        ].map(({ icon, label, value, color, tKey }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
              {icon}
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400">{label}</p>
              {tKey && trendStats && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  <span className="text-green-600 font-semibold">+{trendStats[`${tKey}_7d`] ?? 0}</span> 7天 ·{' '}
                  <span className="text-blue-600 font-semibold">+{trendStats[`${tKey}_30d`] ?? 0}</span> 30天
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      {!trendStats && (
        <button onClick={loadTrendStats}
          className="w-full py-2 text-xs text-primary-600 border border-primary-200 rounded-xl hover:bg-primary-50 transition-colors">
          加载增长趋势数据
        </button>
      )}

      {/* Top consumers / abuse monitor */}
      <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-800">高活跃用户监控</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">突然飙升的活跃度可能是滥用信号</p>
          </div>
          <div className="flex gap-1">
            {[1, 7, 30].map(d => (
              <button key={d}
                onClick={() => { setTopConsumersDays(d); loadTopConsumers(d) }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  topConsumersDays === d ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {d === 1 ? '24小时' : `${d}天`}
              </button>
            ))}
          </div>
        </div>

        {!topConsumers ? (
          <button onClick={() => loadTopConsumers()}
            className="w-full py-2 text-xs text-primary-600 border border-primary-200 rounded-xl hover:bg-primary-50 transition-colors">
            加载活跃用户排行
          </button>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {[
              { key: 'messages' as const, label: '💬 消息', empty: '24h 内无消息' },
              { key: 'requests' as const, label: '🔍 需求', empty: '无新需求' },
              { key: 'posts' as const,    label: '📝 社区帖',  empty: '无新帖' },
            ].map(({ key, label, empty }) => {
              const rows = topConsumers[key] ?? []
              return (
                <div key={key} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">{label}</p>
                  {rows.length === 0 ? (
                    <p className="text-[11px] text-gray-400">{empty}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {rows.map(r => (
                        <li key={r.id} className="flex items-center justify-between text-[11px]">
                          <span className="truncate text-gray-700 flex-1">{r.name || r.email}</span>
                          <span className={`ml-2 px-1.5 py-0.5 rounded-full font-bold ${
                            r.cnt >= 50 ? 'bg-red-100 text-red-600' :
                            r.cnt >= 20 ? 'bg-amber-100 text-amber-600' :
                                          'bg-gray-100 text-gray-500'
                          }`}>
                            {r.cnt}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
