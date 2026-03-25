// ─── Global State (Zustand) ───────────────────────────────────────────────────
// Single store for the entire app. Holds services, user location,
// search filters, and loading state.
//
// To replace mock data with a real API: swap MOCK_SERVICES for an async fetch
// inside a separate action, then call it on app mount.
import { create } from 'zustand'
import type { Service, SearchFilters, ServiceCategory } from '../types'
import { MOCK_SERVICES } from '../data/mockServices'

interface AppState {
  services: Service[]
  userLocation: { lat: number; lng: number } | null
  searchFilters: SearchFilters
  isLoadingDone: boolean

  setLoadingDone: () => void
  setUserLocation: (loc: { lat: number; lng: number } | null) => void
  setSearchFilters: (filters: Partial<SearchFilters>) => void
  addService: (service: Service) => void
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

export const useAppStore = create<AppState>((set, get) => ({
  services: MOCK_SERVICES,
  userLocation: null,
  searchFilters: { sortBy: 'distance' },
  isLoadingDone: false,

  setLoadingDone: () => set({ isLoadingDone: true }),

  setUserLocation: (loc) => set({ userLocation: loc }),

  setSearchFilters: (filters) =>
    set((state) => ({
      searchFilters: { ...state.searchFilters, ...filters },
    })),

  // Prepends a newly posted service to the list (client-side only)
  addService: (service) =>
    set((state) => ({ services: [service, ...state.services] })),

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
          s.tags.some((t) => t.toLowerCase().includes(kw))
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
        if (userLocation) result.sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99))
        break
      case 'rating':
        result.sort((a, b) => b.provider.rating - a.provider.rating)
        break
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'price':
        result.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
        break
    }

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
      result.sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99))
    } else {
      result.sort((a, b) => b.provider.rating - a.provider.rating)
    }
    return result
  },
}))
