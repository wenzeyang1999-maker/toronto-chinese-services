// ─── My Events Section ──────────────────────────────────────────────────────
// Events the current user has RSVP'd to (via event_attendees).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarCheck, MapPin, Clock } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { EVENT_TYPE_CONFIG, formatEventDate, formatEventTime, isUpcoming, type Event } from '../../Events/types'

export default function MyEventsSection() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [events,  setEvents]  = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let active = true
    supabase
      .from('event_attendees')
      .select('event:event_id(*, poster:users(id, name, avatar_url))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!active) return
        const evs = (data ?? [])
          .map((r: any) => (Array.isArray(r.event) ? r.event[0] : r.event))
          .filter(Boolean)
          .map((e: any) => ({ ...e, images: e.images ?? [], attendee_count: e.attendee_count ?? 0 })) as Event[]
        setEvents(evs)
        setLoading(false)
      })
    return () => { active = false }
  }, [user?.id])

  if (loading) return (
    <div className="flex-1 p-4 space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse h-20" />
      ))}
    </div>
  )

  return (
    <div className="flex-1 px-4 py-5 max-w-md lg:max-w-none mx-auto w-full space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <CalendarCheck size={16} className="text-primary-500" />
        <span className="text-sm font-semibold text-gray-700">我报名的活动</span>
      </div>

      {events.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
          <CalendarCheck size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">还没有报名任何活动</p>
          <button onClick={() => navigate('/events')}
            className="mt-3 text-sm text-primary-600 font-semibold hover:underline">
            去看看同城活动 →
          </button>
        </div>
      ) : (
        events.map((ev) => {
          const tc = EVENT_TYPE_CONFIG[ev.event_type]
          const past = !isUpcoming(ev)
          return (
            <button key={ev.id} onClick={() => navigate(`/events/${ev.id}`)}
              className={`w-full flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 text-left hover:shadow-md transition-shadow ${past ? 'opacity-60' : ''}`}>
              <div className="w-12 h-12 rounded-xl bg-primary-50 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-[10px] text-primary-400 leading-none">{formatEventDate(ev.event_date).replace(/日$/, '')}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{ev.title}</p>
                <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5 flex-wrap">
                  <span className="flex items-center gap-0.5">{tc?.emoji} {tc?.label}</span>
                  {ev.event_time && <span className="flex items-center gap-0.5"><Clock size={10} />{formatEventTime(ev.event_time)}</span>}
                  {ev.location_name && <span className="flex items-center gap-0.5 truncate"><MapPin size={10} />{ev.location_name}</span>}
                </div>
              </div>
              {past && <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">已结束</span>}
            </button>
          )
        })
      )}
    </div>
  )
}
