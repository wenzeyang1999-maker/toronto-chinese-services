// ─── Global State (Zustand) ───────────────────────────────────────────────────
import { create } from 'zustand'
import type { Service, SearchFilters, ServiceCategory, ServiceRequest } from '../types'
import { supabase } from '../lib/supabase'

// Shape of a raw row returned from Supabase (services + joined users)
export interface ServiceRow {
  id: string
  category_id: string | null
  title: string
  description: string
  price: number | null
  price_type: 'hourly' | 'fixed' | 'negotiable' | null
  lat: number | null
  lng: number | null
  address: string | null
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
    last_seen_at: string | null
  } | null
  reviews: { rating: number }[] | null
}

interface AppState {
  services: Service[]
  serviceRequests: ServiceRequest[]
  userLocation: { lat: number; lng: number } | null
  searchFilters: SearchFilters
  isLoadingDone: boolean

  setLoadingDone: () => void
  setUserLocation: (loc: { lat: number; lng: number } | null) => void
  setSearchFilters: (filters: Partial<SearchFilters>) => void
  addService: (service: Service) => void
  fetchServices: () => Promise<void>
  fetchServicesByKeyword: (keyword: string) => Promise<Service[]>
  getFilteredServices: () => Service[]
  getServicesByCategory: (category: ServiceCategory) => Service[]
  fetchServiceRequests: () => Promise<void>
  addServiceRequest: (req: ServiceRequest) => void
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
export function mapRow(row: ServiceRow): Service {
  return {
    id: row.id,
    category: (row.category_id ?? 'other') as ServiceCategory,
    title: row.title,
    description: row.description,
    price: row.price?.toString() ?? '0',
    priceType: row.price_type ?? 'hourly',
    location: {
      // Treat 0/null/undefined all as "no real coordinate" — avoids showing
      // bogus distances when the DB stores 0,0 as a placeholder.
      lat: row.lat ? row.lat : undefined,
      lng: row.lng ? row.lng : undefined,
      address: row.address ?? row.area ?? 'Toronto',
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
      lastSeenAt: row.provider?.last_seen_at ?? null,
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

function mapRequestRow(row: any): ServiceRequest {
  const expires = new Date(row.expires_at)
  const daysLeft = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86_400_000))
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description ?? '',
    category: (row.category ?? 'other') as ServiceCategory,
    area: row.area ?? '',
    city: row.city ?? 'Toronto',
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    budget: row.budget ?? '',
    expiresAt: row.expires_at,
    status: row.status,
    createdAt: row.created_at,
    requester: {
      id: row.requester?.id ?? row.user_id,
      name: row.requester?.name ?? '用户',
      avatar: row.requester?.avatar_url ?? undefined,
    },
    daysLeft,
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  services: [],
  serviceRequests: [],
  userLocation: null,
  searchFilters: { sortBy: 'rating' },
  isLoadingDone: false,

  setLoadingDone: () => set({ isLoadingDone: true }),

  setUserLocation: (loc) => set({ userLocation: loc }),

  setSearchFilters: (filters) =>
    set((state) => ({
      searchFilters: { ...state.searchFilters, ...filters },
    })),

  addService: (service) =>
    set((state) => ({ services: [service, ...state.services] })),

  addServiceRequest: (req) =>
    set((state) => ({ serviceRequests: [req, ...state.serviceRequests] })),

  fetchServiceRequests: async () => {
    const { data, error } = await supabase
      .from('service_requests')
      .select('*, requester:users(id, name, avatar_url)')
      .eq('status', 'open')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    if (!error && data) {
      set({ serviceRequests: data.map(mapRequestRow) })
    }
  },

  fetchServices: async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*, provider:users(id, name, phone, wechat, avatar_url, last_seen_at), reviews(rating)')
      .eq('is_available', true)
      .order('created_at', { ascending: false })
    if (!error && data) {
      set({ services: (data as ServiceRow[]).map(mapRow) })
    }
  },

  fetchServicesByKeyword: async (keyword: string) => {
    const kw = keyword.trim()
    if (!kw) return []
    // Uses trigram GIN index for fast ILIKE — fts_search_patch.sql must be applied
    const { data, error } = await supabase
      .from('services')
      .select('*, provider:users(id, name, phone, wechat, avatar_url, last_seen_at), reviews(rating)')
      .eq('is_available', true)
      .or(`title.ilike.%${kw}%,description.ilike.%${kw}%`)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error || !data) return []
    return (data as ServiceRow[]).map(mapRow)
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
      const variants = (searchFilters.keywordVariants ?? []).map((term) => term.toLowerCase())
      const allTerms = Array.from(new Set([kw, ...variants])).filter(Boolean)
      result = result.filter(
        (s) =>
          allTerms.some((term) =>
            s.title.toLowerCase().includes(term) ||
            s.description.toLowerCase().includes(term) ||
            (s.tags ?? []).some((t) => t.toLowerCase().includes(term))
          )
      )
    }
    if (searchFilters.minRating) {
      result = result.filter((s) => s.provider.rating >= searchFilters.minRating!)
    }

    if (userLocation) {
      result = result.map((s) => ({
        ...s,
        distance:
          s.location.lat != null && s.location.lng != null
            ? calcDistance(
                userLocation.lat,
                userLocation.lng,
                s.location.lat,
                s.location.lng
              )
            : undefined,
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
        userLocation && s.location.lat != null && s.location.lng != null
          ? { ...s, distance: calcDistance(userLocation.lat, userLocation.lng, s.location.lat, s.location.lng) }
          : { ...s, distance: undefined }
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
