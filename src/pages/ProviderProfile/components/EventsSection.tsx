import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import type { Event } from '../../Events/types'
import { EVENT_TYPE_CONFIG, getPriceLabel, formatEventDate, isUpcoming } from '../../Events/types'

interface Props {
  events: Event[]
}

export default function EventsSection({ events }: Props) {
  const navigate = useNavigate()

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 mb-3 px-1">
        发布的活动（{events.length}）
      </h2>
      <div className="space-y-2">
        {events.map((ev, i) => {
          const cfg  = EVENT_TYPE_CONFIG[ev.event_type]
          const past = !isUpcoming(ev)
          return (
            <motion.div key={ev.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/events/${ev.id}`)}
              className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer
                         hover:border-primary-200 hover:shadow-md transition-all flex gap-3 items-start
                         ${past ? 'opacity-60' : ''}`}
            >
              <div className="flex-shrink-0 w-12 flex flex-col items-center bg-primary-50 rounded-xl py-1.5 px-1 text-center">
                <span className="text-[10px] font-bold text-primary-400 leading-none">
                  {new Date(ev.event_date + 'T00:00:00').toLocaleString('zh-CN', { month: 'short' })}
                </span>
                <span className="text-xl font-extrabold text-primary-700 leading-tight">
                  {new Date(ev.event_date + 'T00:00:00').getDate()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-1 flex-1">{ev.title}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.color}`}>
                    {cfg.emoji} {cfg.label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-gray-400">{formatEventDate(ev.event_date)}</p>
                  <p className={`text-xs font-bold ${ev.price ? 'text-primary-600' : 'text-green-600'}`}>
                    {getPriceLabel(ev)}
                  </p>
                  {past && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">已结束</span>}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
