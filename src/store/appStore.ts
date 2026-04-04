// ─── Global State (Zustand) ───────────────────────────────────────────────────
import { create } from 'zustand'
import type { Service, SearchFilters, ServiceCategory } from '../types'
import { supabase } from '../lib/supabase'

// Shape of a raw row returned from Supabase (services + joined users)
interface ServiceRow {
  id: string
  category_id: string | null
  title: string
  description: string
  price: number | null
  price_type: 'hourly' | 'fixed' | 'negotiable' | null
  lat: number | null
  lng: number | null
  area: string | null
  service_areas: string[] | null
  city: string | null
  tags: string[] | null
  images: string[] | null
  is_available: boolean | null
  is_promoted: boolean | null
  is_verified: boolean | null
  created_at: string | null
  updated_at: string | null
  provider_id: string
  provider: {
    id: string
    name: string | null
    phone: string | null
    wechat: string | null
    avatar_url: string | null
  } | null
  reviews: { rating: number }[] | null
}

interface AppState {
  services: Service[]
  userLocation: { lat: number; lng: number } | null
  searchFilters: SearchFilters
  isLoadingDone: boolean
  isServicesReady: boolean

  setLoadingDone: () => void
  setUserLocation: (loc: { lat: number; lng: number } | null) => void
  setSearchFilters: (filters: Partial<SearchFilters>) => void
  addService: (service: Service) => void
  fetchServices: () => Promise<void>
  getFilteredServices: () => Service[]
  getServicesByCategory: (category: ServiceCategory) => Service[]
}

// Haversine formula — returns distance in km between two lat/lng points
function calcDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Map a Supabase services row to the frontend Service type
function mapRow(row: ServiceRow): Service {
  return {
    id: row.id,
    category: (row.category_id ?? 'other') as ServiceCategory,
    title: row.title,
    description: row.description,
    price: row.price?.toString() ?? '0',
    priceType: row.price_type ?? 'hourly',
    location: {
      lat: row.lat ?? 43.6532,
      lng: row.lng ?? -79.3832,
      address: row.area ?? 'Toronto',
      city: row.city ?? 'Toronto',
      area: row.area ?? undefined,
    },
    provider: {
      id: row.provider?.id ?? row.provider_id,
      name: row.provider?.name ?? '服务商',
      phone: row.provider?.phone ?? '',
      wechat: row.provider?.wechat ?? undefined,
      avatar: row.provider?.avatar_url ?? undefined,
      rating: row.reviews?.length
        ? row.reviews.reduce((s, r) => s + r.rating, 0) / row.reviews.length
        : 0,
      reviewCount: row.reviews?.length ?? 0,
      verified: row.is_verified ?? false,
      joinedAt: row.created_at?.slice(0, 10) ?? '',
      languages: ['中文'],
    },
    tags: row.tags ?? [],
    images: row.images ?? [],
    available:   row.is_available ?? true,
    isPromoted:  row.is_promoted ?? false,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  services: [],
  userLocation: null,
  searchFilters: { sortBy: 'distance' },
  isLoadingDone: false,
  isServicesReady: false,

  setLoadingDone: () => set({ isLoadingDone: true }),

  setUserLocation: (loc) => set({ userLocation: loc }),

  setSearchFilters: (filters) =>
    set((state) => ({
      searchFilters: { ...state.searchFilters, ...filters },
    })),

  addService: (service) =>
    set((state) => ({ services: [service, ...state.services] })),

  fetchServices: async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*, provider:users(id, name, phone, wechat, avatar_url), reviews(rating)')
      .eq('is_available', true)
      .order('created_at', { ascending: false })
    if (!error && data) {
      set({ services: (data as ServiceRow[]).map(mapRow), isServicesReady: true })
    } else {
      // Mark ready even on error so loading screen doesn't hang
      set({ isServicesReady: true })
    }
  },

  // Returns services filtered by keyword, category, rating and sorted accordingly.
  // Attaches calculated distance if user location is available.
  getFilteredServices: () => {
    const { services, userLocation, searchFilters } = get()
    let result = services.filter((s) => s.available)

    if (searchFilters.category) {
      result = result.filter((s) => s.category === searchFilters.category)
    }
    if (searchFilters.keyword) {
      const kw = searchFilters.keyword.toLowerCase()
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(kw) ||
          s.description.toLowerCase().includes(kw) ||
          (s.tags ?? []).some((t) => t.toLowerCase().includes(kw))
      )
    }
    if (searchFilters.minRating) {
      result = result.filter((s) => s.provider.rating >= searchFilters.minRating!)
    }

    if (userLocation) {
      result = result.map((s) => ({
        ...s,
        distance: calcDistance(
          userLocation.lat, userLocation.lng,
          s.location.lat, s.location.lng
        ),
      }))
    }

    switch (searchFilters.sortBy) {
      case 'distance':
        if (userLocation) result.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
        break
      case 'rating':
        result.sort((a, b) => b.provider.rating - a.provider.rating)
        break
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'price':
        result.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0))
        break
    }

    // Promoted listings always float to the top regardless of sort
    result.sort((a, b) => (b.isPromoted ? 1 : 0) - (a.isPromoted ? 1 : 0))

    return result
  },

  // Returns services for a single category, sorted by distance or rating
  getServicesByCategory: (category) => {
    const { services, userLocation } = get()
    let result = services
      .filter((s) => s.available && s.category === category)
      .map((s) =>
        userLocation
          ? { ...s, distance: calcDistance(userLocation.lat, userLocation.lng, s.location.lat, s.location.lng) }
          : s
      )
    if (userLocation) {
      result.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
    } else {
      result.sort((a, b) => b.provider.rating - a.provider.rating)
    }
    result.sort((a, b) => (b.isPromoted ? 1 : 0) - (a.isPromoted ? 1 : 0))
    return result
  },
}))
