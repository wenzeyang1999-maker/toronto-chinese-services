// ─── EventRsvpButton ────────────────────────────────────────────────────────
// Join / cancel RSVP for an event, with live count vs capacity. Self-contained:
// checks whether the current user is going, toggles their row in event_attendees
// (the DB trigger keeps events.attendee_count in sync).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { toast } from '../../lib/toast'

interface Props {
  eventId: string
  maxAttendees: number | null
  attendeeCount: number
}

export default function EventRsvpButton({ eventId, maxAttendees, attendeeCount }: Props) {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)
  const [going, setGoing]   = useState(false)
  const [count, setCount]   = useState(attendeeCount)
  const [busy, setBusy]     = useState(false)
  const [ready, setReady]   = useState(false)

  useEffect(() => {
    setCount(attendeeCount)
  }, [attendeeCount])

  useEffect(() => {
    if (!user) { setReady(true); return }
    let active = true
    supabase.from('event_attendees').select('id').eq('event_id', eventId).eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (active) { setGoing(!!data); setReady(true) } })
    return () => { active = false }
  }, [eventId, user?.id])

  const full = maxAttendees != null && count >= maxAttendees && !going

  async function toggle() {
    if (!user) { navigate('/login'); return }
    if (busy) return
    setBusy(true)
    if (going) {
      const { error } = await supabase.from('event_attendees').delete().eq('event_id', eventId).eq('user_id', user.id)
      if (!error) { setGoing(false); setCount((c) => Math.max(0, c - 1)) }
      else toast('取消报名失败，请重试', 'error')
    } else {
      const { error } = await supabase.from('event_attendees').insert({ event_id: eventId, user_id: user.id })
      if (!error) { setGoing(true); setCount((c) => c + 1); toast('报名成功 ✓', 'success') }
      else toast('报名失败，请重试', 'error')
    }
    setBusy(false)
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        disabled={busy || full || !ready}
        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-colors disabled:opacity-60
          ${going
            ? 'bg-green-50 border border-green-300 text-green-700 hover:bg-red-50 hover:border-red-200 hover:text-red-500'
            : 'bg-primary-600 text-white hover:bg-primary-700'}`}
      >
        {going ? <><Check size={16} /> 已报名（点击取消）</> : full ? '名额已满' : <><UserPlus size={16} /> 我要报名</>}
      </button>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-gray-800">{count}{maxAttendees != null && ` / ${maxAttendees}`}</p>
        <p className="text-[11px] text-gray-400">已报名</p>
      </div>
    </div>
  )
}
