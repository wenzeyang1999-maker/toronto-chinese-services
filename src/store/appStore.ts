// ─── Global State (Zustand) ───────────────────────────────────────────────────
import { create } from 'zustand'
import type { Service, SearchFilters, ServiceCategory, ServiceRequest } from '../types'
import { supabase } from '../lib/supabase'
import { toast } from '../lib/toast'
import { calcDistance } from '../lib/geo'

// Cache user location across page reloads so the map works immediately and the
// browser doesn't need to re-prompt on every visit.
const USER_LOCATION_KEY = 'tcs_user_location'
function readCachedLocation(): { lat: number; lng: number } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(USER_LOCATION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
      return { lat: parsed.lat, lng: parsed.lng }
    }
  } catch { /* ignore */ }
  return null
}

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
  promoted_until: string | null
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
    created_at: string | null
    phone_verified: boolean | null
    business_verified: boolean | null
    membership_level: string | null
    is_online: boolean | null
  } | null
  reviews: { rating: number }[] | null
}

interface AppState {
  services: Service[]
  servicesLoaded: boolean
  servicesError: boolean
  serviceRequests: ServiceRequest[]
  userLocation: { lat: number; lng: number } | null
  searchFilters: SearchFilters
  isLoadingDone: boolean
  servicesHasMore: boolean
  servicesLoadingMore: boolean

  setLoadingDone: () => void
  setUserLocation: (loc: { lat: number; lng: number } | null) => void
  setSearchFilters: (filters: Partial<SearchFilters>) => void
  addService: (service: Service) => void
  fetchServices: (append?: boolean) => Promise<void>
  fetchServicesByKeyword: (keyword: string) => Promise<Service[]>
  fetchServicesByCategory: (category: ServiceCategory, offset?: number) => Promise<{ items: Service[]; hasMore: boolean; ok: boolean }>
  getFilteredServices: () => Service[]
  getServicesByCategory: (category: ServiceCategory) => Service[]
  fetchServiceRequests: () => Promise<void>
  addServiceRequest: (req: ServiceRequest) => void
  removeServiceRequest: (id: string) => void
}

const SERVICES_PAGE_SIZE = 40

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
      verified:         row.is_verified ?? false,
      phoneVerified:    row.provider?.phone_verified    ?? false,
      businessVerified: row.provider?.business_verified ?? false,
      membershipLevel:  (row.provider?.membership_level as 'L1' | 'L2' | 'L3') ?? 'L1',
      joinedAt: row.provider?.created_at?.slice(0, 10) ?? row.created_at?.slice(0, 10) ?? '',
      lastSeenAt: row.provider?.last_seen_at ?? null,
      isOnline: row.provider?.is_online ?? false,
      languages: ['中文'],
    },
    tags: row.tags ?? [],
    images: row.images ?? [],
    available:   row.is_available ?? true,
    // A promotion is active if is_promoted AND (no expiry set — admin grant — or
    // the expiry hasn't passed yet). Free member promotions expire without a cron.
    isPromoted:  (row.is_promoted ?? false) && (!row.promoted_until || new Date(row.promoted_until).getTime() > Date.now()),
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
    serviceAtStart: row.service_at_start ?? undefined,
    serviceAtEnd:   row.service_at_end   ?? undefined,
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
  servicesLoaded: false,
  servicesError: false,
  serviceRequests: [],
  userLocation: readCachedLocation(),
  searchFilters: { sortBy: 'rating' },
  // Branded splash shows only on the very first visit; reloads skip straight in.
  isLoadingDone: (() => {
    try { return !!window.localStorage.getItem('tcs_splash_seen') } catch { return false }
  })(),
  servicesHasMore: true,
  servicesLoadingMore: false,

  setLoadingDone: () => {
    try { window.localStorage.setItem('tcs_splash_seen', '1') } catch { /* ignore */ }
    set({ isLoadingDone: true })
  },

  setUserLocation: (loc) => {
    set({ userLocation: loc })
    // Persist only on successful fix — keep last-known coords if a refresh fails.
    if (loc && typeof window !== 'undefined') {
      try { window.localStorage.setItem(USER_LOCATION_KEY, JSON.stringify({ lat: loc.lat, lng: loc.lng, ts: Date.now() })) }
      catch { /* ignore */ }
    }
  },

  setSearchFilters: (filters) =>
    set((state) => ({
      searchFilters: { ...state.searchFilters, ...filters },
    })),

  addService: (service) =>
    set((state) => ({ services: [service, ...state.services] })),

  addServiceRequest: (req) =>
    set((state) => ({ serviceRequests: [req, ...state.serviceRequests] })),

  removeServiceRequest: (id) =>
    set((state) => ({ serviceRequests: state.serviceRequests.filter((r) => r.id !== id) })),

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

  fetchServices: async (append = false) => {
    const current = get().services
    const offset  = append ? current.length : 0
    if (append) set({ servicesLoadingMore: true })

    // Cold starts occasionally drop the first request. Retry the initial load a
    // couple of times with backoff so a transient blip self-heals silently —
    // only surface an error (toast) once all attempts fail.
    const runQuery = () => supabase
      .from('services')
      .select('*, provider:users(id, name, avatar_url, last_seen_at, created_at, phone_verified, business_verified, membership_level, is_online), reviews(rating)')
      .eq('is_available', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + SERVICES_PAGE_SIZE - 1)

    const maxAttempts = append ? 1 : 3
    let data: Awaited<ReturnType<typeof runQuery>>['data'] = null
    let error: Awaited<ReturnType<typeof runQuery>>['error'] = null
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const res = await runQuery()
      data = res.data; error = res.error
      if (!error && data) break
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 400 * attempt))
    }

    if (error || !data) {
      set({ servicesLoadingMore: false, servicesLoaded: true, servicesError: true })
      if (!append) toast('加载失败，请检查网络后重试', 'error')
      return
    }
    const mapped = (data as ServiceRow[]).map(mapRow)
    set({
      services: append ? [...current, ...mapped] : mapped,
      servicesHasMore: data.length === SERVICES_PAGE_SIZE,
      servicesLoadingMore: false,
      servicesLoaded: true,
      servicesError: false,
    })
  },

  fetchServicesByKeyword: async (keyword: string) => {
    const kw = keyword.trim()
    if (!kw) return []
    // Uses trigram GIN index for fast ILIKE — fts_search_patch.sql must be applied
    const { data, error } = await supabase
      .from('services')
      .select('*, provider:users(id, name, avatar_url, last_seen_at, created_at, phone_verified, business_verified, membership_level, is_online), reviews(rating)')
      .eq('is_available', true)
      .or(`title.ilike.%${kw}%,description.ilike.%${kw}%`)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error || !data) return []
    return (data as ServiceRow[]).map(mapRow)
  },

  // Query one category directly from the DB with real pagination — the Category
  // page must NOT filter the globally-loaded `services` (only the newest 40 are
  // in memory, so older services in a category would never appear).
  fetchServicesByCategory: async (category, offset = 0) => {
    const { data, error } = await supabase
      .from('services')
      .select('*, provider:users(id, name, avatar_url, last_seen_at, created_at, phone_verified, business_verified, membership_level, is_online), reviews(rating)')
      .eq('is_available', true)
      .eq('category_id', category)
      .order('created_at', { ascending: false })
      .range(offset, offset + SERVICES_PAGE_SIZE - 1)
    if (error || !data) return { items: [], hasMore: false, ok: false }
    return { items: (data as ServiceRow[]).map(mapRow), hasMore: data.length === SERVICES_PAGE_SIZE, ok: true }
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
    if (searchFilters.onlineOnly) {
      result = result.filter((s) => s.provider.isOnline)
    }
    // Price range — only applies to services with a numeric price (skip 面议).
    if (searchFilters.minPrice != null || searchFilters.maxPrice != null) {
      result = result.filter((s) => {
        if (s.priceType === 'negotiable') return false
        const p = parseFloat(s.price)
        if (Number.isNaN(p)) return false
        if (searchFilters.minPrice != null && p < searchFilters.minPrice) return false
        if (searchFilters.maxPrice != null && p > searchFilters.maxPrice) return false
        return true
      })
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
    const result = services
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
