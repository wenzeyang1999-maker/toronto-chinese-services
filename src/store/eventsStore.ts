// ─── Events Store (Zustand) ────────────────────────────────────────────────────
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Event, EventFilters } from '../pages/Events/types'
import { isUpcoming } from '../pages/Events/types'

interface EventRow {
  id: string
  poster_id: string
  poster: { id: string; name: string; avatar_url: string | null } | null
  event_type: string
  title: string
  description: string
  event_date: string
  event_time: string | null
  event_end_time: string | null
  location_name: string | null
  address: string | null
  area: string[] | null
  price: number | null
  max_attendees: number | null
  images: string[] | null
  contact_name: string
  contact_phone: string
  contact_wechat: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

function mapRow(row: EventRow): Event {
  return {
    id:             row.id,
    poster_id:      row.poster_id,
    poster:         row.poster
      ? { id: row.poster.id, name: row.poster.name, avatar_url: row.poster.avatar_url }
      : undefined,
    event_type:     row.event_type as Event['event_type'],
    title:          row.title,
    description:    row.description,
    event_date:     row.event_date,
    event_time:     row.event_time,
    event_end_time: row.event_end_time,
    location_name:  row.location_name,
    address:        row.address,
    area:           row.area,
    price:          row.price,
    max_attendees:  row.max_attendees,
    images:         row.images ?? [],
    contact_name:   row.contact_name,
    contact_phone:  row.contact_phone,
    contact_wechat: row.contact_wechat,
    is_active:      row.is_active,
    created_at:     row.created_at,
    updated_at:     row.updated_at,
  }
}

interface EventsState {
  events: Event[]
  filters: EventFilters
  isReady: boolean

  fetchEvents: () => Promise<void>
  setFilters: (f: Partial<EventFilters>) => void
  clearFilters: () => void
  getFilteredEvents: () => Event[]
  addEvent: (event: Event) => void
}

export const useEventsStore = create<EventsState>((set, get) => ({
  events:  [],
  filters: { upcoming_only: true },
  isReady: false,

  fetchEvents: async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*, poster:users(id, name, avatar_url)')
      .eq('is_active', true)
      .order('event_date', { ascending: true })
    if (!error && data) {
      set({ events: (data as EventRow[]).map(mapRow), isReady: true })
    } else {
      set({ isReady: true })
    }
  },

  setFilters: (f) =>
    set((state) => ({ filters: { ...state.filters, ...f } })),

  clearFilters: () => set({ filters: { upcoming_only: true } }),

  getFilteredEvents: () => {
    const { events, filters } = get()
    let result = events.filter((e) => e.is_active)

    if (filters.upcoming_only) {
      result = result.filter(isUpcoming)
    }
    if (filters.event_type) {
      result = result.filter((e) => e.event_type === filters.event_type)
    }
    if (filters.area) {
      result = result.filter((e) => e.area?.includes(filters.area!))
    }
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase()
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(kw) ||
          e.description.toLowerCase().includes(kw) ||
          e.location_name?.toLowerCase().includes(kw)
      )
    }

    return result
  },

  addEvent: (event) =>
    set((state) => ({ events: [event, ...state.events] })),
}))
