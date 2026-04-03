// ─── Real Estate Store (Zustand) ──────────────────────────────────────────────
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Property, RealEstateFilters } from '../pages/RealEstate/types'

interface PropertyRow {
  id: string
  poster_id: string
  poster: { id: string; name: string; avatar_url: string | null } | null
  listing_type: string
  title: string
  property_type: string
  bedrooms: number | null
  bathrooms: number | null
  description: string
  price: number | null
  price_type: string
  pet_friendly: boolean
  parking: boolean
  utilities_included: boolean
  images: string[] | null
  area: string[] | null
  city: string | null
  address: string | null
  available_date: string | null
  contact_name: string
  contact_phone: string
  contact_wechat: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

function mapRow(row: PropertyRow): Property {
  return {
    id:           row.id,
    poster_id:    row.poster_id,
    poster:       row.poster
      ? { id: row.poster.id, name: row.poster.name, avatar_url: row.poster.avatar_url }
      : undefined,
    listing_type:       (row.listing_type ?? 'rent') as Property['listing_type'],
    title:              row.title,
    property_type:      row.property_type as Property['property_type'],
    bedrooms:           row.bedrooms,
    bathrooms:          row.bathrooms,
    description:        row.description,
    price:              row.price,
    price_type:         row.price_type as Property['price_type'],
    pet_friendly:       row.pet_friendly,
    parking:            row.parking,
    utilities_included: row.utilities_included,
    images:             row.images ?? [],
    area:               row.area,
    city:               row.city ?? 'Toronto',
    address:            row.address,
    available_date:     row.available_date,
    contact_name:       row.contact_name,
    contact_phone:      row.contact_phone,
    contact_wechat:     row.contact_wechat,
    is_active:          row.is_active,
    created_at:         row.created_at,
    updated_at:         row.updated_at,
  }
}

interface RealEstateState {
  properties: Property[]
  filters: RealEstateFilters
  isReady: boolean

  fetchProperties: () => Promise<void>
  setFilters: (f: Partial<RealEstateFilters>) => void
  clearFilters: () => void
  getFilteredProperties: () => Property[]
  addProperty: (p: Property) => void
}

export const useRealEstateStore = create<RealEstateState>((set, get) => ({
  properties: [],
  filters:    { listing_type: 'rent' },
  isReady:    false,

  fetchProperties: async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('*, poster:users(id, name, avatar_url)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (!error && data) {
      set({ properties: (data as PropertyRow[]).map(mapRow), isReady: true })
    } else {
      set({ isReady: true })
    }
  },

  setFilters: (f) =>
    set((state) => ({ filters: { ...state.filters, ...f } })),

  clearFilters: () => set({ filters: { listing_type: get().filters.listing_type } }),

  getFilteredProperties: () => {
    const { properties, filters } = get()
    let result = properties.filter((p) => p.is_active)

    if (filters.listing_type) {
      result = result.filter((p) => p.listing_type === filters.listing_type)
    }
    if (filters.property_type) {
      result = result.filter((p) => p.property_type === filters.property_type)
    }
    if (filters.area) {
      result = result.filter((p) => p.area?.includes(filters.area!))
    }
    if (filters.bedrooms != null) {
      result = result.filter((p) => p.bedrooms === filters.bedrooms)
    }
    if (filters.max_price != null) {
      result = result.filter((p) => p.price_type === 'negotiable' || (p.price != null && p.price <= filters.max_price!))
    }
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase()
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(kw) ||
          p.description.toLowerCase().includes(kw) ||
          (p.address ?? '').toLowerCase().includes(kw)
      )
    }

    return result
  },

  addProperty: (p) =>
    set((state) => ({ properties: [p, ...state.properties] })),
}))
