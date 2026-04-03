// ─── Secondhand Store (Zustand) ───────────────────────────────────────────────
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { SecondhandItem, SecondhandFilters } from '../pages/Secondhand/types'

interface ItemRow {
  id: string
  seller_id: string
  seller: { id: string; name: string; avatar_url: string | null } | null
  title: string
  category: string
  condition: string
  description: string
  price: number | null
  is_free: boolean
  images: string[] | null
  area: string[] | null
  city: string | null
  contact_name: string
  contact_phone: string
  contact_wechat: string | null
  is_active: boolean
  is_sold: boolean
  created_at: string
  updated_at: string
}

function mapRow(row: ItemRow): SecondhandItem {
  return {
    id:            row.id,
    seller_id:     row.seller_id,
    seller:        row.seller
      ? { id: row.seller.id, name: row.seller.name, avatar_url: row.seller.avatar_url }
      : undefined,
    title:         row.title,
    category:      row.category as SecondhandItem['category'],
    condition:     row.condition as SecondhandItem['condition'],
    description:   row.description,
    price:         row.price,
    is_free:       row.is_free,
    images:        row.images ?? [],
    area:          row.area,
    city:          row.city ?? 'Toronto',
    contact_name:  row.contact_name,
    contact_phone: row.contact_phone,
    contact_wechat: row.contact_wechat,
    is_active:     row.is_active,
    is_sold:       row.is_sold,
    created_at:    row.created_at,
    updated_at:    row.updated_at,
  }
}

interface SecondhandState {
  items: SecondhandItem[]
  filters: SecondhandFilters
  isReady: boolean

  fetchItems: () => Promise<void>
  setFilters: (f: Partial<SecondhandFilters>) => void
  clearFilters: () => void
  getFilteredItems: () => SecondhandItem[]
  addItem: (item: SecondhandItem) => void
}

export const useSecondhandStore = create<SecondhandState>((set, get) => ({
  items:   [],
  filters: {},
  isReady: false,

  fetchItems: async () => {
    const { data, error } = await supabase
      .from('secondhand')
      .select('*, seller:users(id, name, avatar_url)')
      .eq('is_active', true)
      .eq('is_sold', false)
      .order('created_at', { ascending: false })
    if (!error && data) {
      set({ items: (data as ItemRow[]).map(mapRow), isReady: true })
    } else {
      set({ isReady: true })
    }
  },

  setFilters: (f) =>
    set((state) => ({ filters: { ...state.filters, ...f } })),

  clearFilters: () => set({ filters: {} }),

  getFilteredItems: () => {
    const { items, filters } = get()
    let result = items.filter((i) => i.is_active && !i.is_sold)

    if (filters.category) {
      result = result.filter((i) => i.category === filters.category)
    }
    if (filters.condition) {
      result = result.filter((i) => i.condition === filters.condition)
    }
    if (filters.area) {
      result = result.filter((i) => i.area?.includes(filters.area!))
    }
    if (filters.max_price != null) {
      result = result.filter((i) => i.is_free || (i.price != null && i.price <= filters.max_price!))
    }
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase()
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(kw) ||
          i.description.toLowerCase().includes(kw)
      )
    }

    return result
  },

  addItem: (item) =>
    set((state) => ({ items: [item, ...state.items] })),
}))
