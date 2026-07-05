// ─── Event actions ────────────────────────────────────────────────────────────
// "Add to calendar" (.ics with a built-in reminder) + "navigate" (maps URL).
// The .ics VALARM covers the "提醒" leg of the Meetup trio — the user's own
// calendar fires the reminder, no server scheduler needed.
import type { Event } from '../pages/Events/types'

// Escapes ICS text per RFC 5545 (backslash, semicolon, comma, newlines).
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

// "YYYY-MM-DD" + "HH:MM:SS" → "YYYYMMDDTHHMMSS" (floating local time).
function stamp(date: string, time: string | null): string {
  const d = date.replace(/-/g, '')
  if (!time) return d
  return `${d}T${time.replace(/:/g, '').slice(0, 6).padEnd(6, '0')}`
}

function addHours(date: string, time: string, hours: number): string {
  const dt = new Date(`${date}T${time}`)
  dt.setHours(dt.getHours() + hours)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}${p(dt.getMonth() + 1)}${p(dt.getDate())}T${p(dt.getHours())}${p(dt.getMinutes())}00`
}

export function buildIcs(ev: Event): string {
  const timed = !!ev.event_time
  const start = timed
    ? `DTSTART:${stamp(ev.event_date, ev.event_time)}`
    : `DTSTART;VALUE=DATE:${ev.event_date.replace(/-/g, '')}`
  const end = timed
    ? `DTEND:${ev.event_end_time ? stamp(ev.event_date, ev.event_end_time) : addHours(ev.event_date, ev.event_time!, 2)}`
    : `DTEND;VALUE=DATE:${ev.event_date.replace(/-/g, '')}`
  const loc = [ev.location_name, ev.address].filter(Boolean).join(' ')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//华邻//events//CN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${ev.id}@hualin`,
    start,
    end,
    `SUMMARY:${esc(ev.title)}`,
    ev.description ? `DESCRIPTION:${esc(ev.description)}` : '',
    loc ? `LOCATION:${esc(loc)}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:活动即将开始',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

export function downloadIcs(ev: Event): void {
  const blob = new Blob([buildIcs(ev)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${ev.title.replace(/[^\p{L}\p{N} ]/gu, '').slice(0, 40) || 'event'}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Cross-platform maps deep link (opens the native app on mobile, web on desktop).
export function mapNavUrl(ev: Event): string | null {
  const q = ev.address || ev.location_name
  if (!q) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}
