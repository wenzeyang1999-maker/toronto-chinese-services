// ─── Events Module — Type Definitions ─────────────────────────────────────────

export type EventType =
  | 'party'
  | 'exhibition'
  | 'course'
  | 'performance'
  | 'sports'
  | 'food'
  | 'culture'
  | 'other'

export interface EventPoster {
  id: string
  name: string
  avatar_url: string | null
}

export interface Event {
  id: string
  poster_id: string
  poster?: EventPoster

  event_type: EventType
  title: string
  description: string

  event_date: string        // ISO date string YYYY-MM-DD
  event_time: string | null // HH:MM:SS or null
  event_end_time: string | null

  location_name: string | null
  address: string | null
  area: string[] | null

  price: number | null      // null = free

  max_attendees: number | null

  images: string[]

  contact_name: string
  contact_phone: string
  contact_wechat: string | null

  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EventFilters {
  keyword?: string
  event_type?: EventType
  area?: string
  upcoming_only?: boolean
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export const EVENT_TYPE_CONFIG: Record<EventType, { label: string; emoji: string; color: string }> = {
  party:       { label: '聚会',   emoji: '🎉', color: 'bg-pink-100 text-pink-700' },
  exhibition:  { label: '展览',   emoji: '🖼️', color: 'bg-purple-100 text-purple-700' },
  course:      { label: '课程',   emoji: '📖', color: 'bg-blue-100 text-blue-700' },
  performance: { label: '演出',   emoji: '🎭', color: 'bg-orange-100 text-orange-700' },
  sports:      { label: '运动',   emoji: '⚽', color: 'bg-green-100 text-green-700' },
  food:        { label: '美食',   emoji: '🍜', color: 'bg-yellow-100 text-yellow-700' },
  culture:     { label: '文化',   emoji: '🏮', color: 'bg-red-100 text-red-700' },
  other:       { label: '其他',   emoji: '📅', color: 'bg-gray-100 text-gray-600' },
}

export function getPriceLabel(event: Pick<Event, 'price'>): string {
  if (event.price == null || event.price === 0) return '免费'
  return `$${event.price}`
}

/** Format event_date (YYYY-MM-DD) to "4月15日" */
export function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** Format event_time (HH:MM:SS) to "14:30" */
export function formatEventTime(timeStr: string | null): string | null {
  if (!timeStr) return null
  const parts = timeStr.split(':')
  return `${parts[0]}:${parts[1]}`
}

/** Returns true if event_date is today or in the future */
export function isUpcoming(event: Pick<Event, 'event_date'>): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const eventDay = new Date(event.event_date + 'T00:00:00')
  return eventDay >= today
}
