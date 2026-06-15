export type ServiceCategory =
  | 'moving'
  | 'cleaning'
  | 'ride'
  | 'renovation'
  | 'cashwork'
  | 'food'
  | 'tax'
  | 'legal'
  | 'immigration'
  | 'tutoring'
  | 'beauty'
  | 'tcm'
  | 'pet'
  | 'photo'
  | 'translation'
  | 'it'
  | 'driving'
  | 'lawn'
  | 'childcare'
  | 'insurance'
  | 'handyman'
  | 'junk'
  | 'other'

export interface Location {
  lat?: number
  lng?: number
  address: string
  city: string
  area?: string
}

// Online provider broadcasting live location (shown as green pin on map)
export interface OnlineProvider {
  id: string
  name: string
  avatar_url: string | null
  online_lat: number
  online_lng: number
  skill_tags: string[]
}

export interface ServiceProvider {
  id: string
  name: string
  phone: string
  wechat?: string
  avatar?: string
  rating: number
  reviewCount: number
  verified: boolean
  phoneVerified: boolean
  businessVerified: boolean
  joinedAt: string
  lastSeenAt?: string | null
  languages: string[]
}

export interface Service {
  id: string
  category: ServiceCategory
  title: string
  description: string
  price: string
  priceType: 'hourly' | 'fixed' | 'negotiable'
  location: Location
  provider: ServiceProvider
  tags: string[]
  images?: string[]
  available: boolean
  isPromoted: boolean
  createdAt: string
  updatedAt: string
  distance?: number // km, calculated at runtime
}

export interface SearchFilters {
  category?: ServiceCategory
  keyword?: string
  keywordVariants?: string[]
  maxDistance?: number
  minRating?: number
  priceType?: string
  sortBy: 'distance' | 'rating' | 'newest' | 'price'
}

export interface ServiceRequest {
  id: string
  userId: string
  title: string
  description: string
  category: ServiceCategory
  area: string
  city: string
  lat?: number
  lng?: number
  budget: string
  /** When the service is needed (start) — independent of post expiry. ISO. */
  serviceAtStart?: string
  /** When the service is needed (end). ISO. */
  serviceAtEnd?: string
  expiresAt: string
  status: 'open' | 'closed'
  createdAt: string
  requester: {
    id: string
    name: string
    avatar?: string
  }
  daysLeft: number   // calculated at runtime
}

export interface PostServiceForm {
  category: ServiceCategory
  title: string
  description: string
  price: string
  priceType: 'hourly' | 'fixed' | 'negotiable'
  name: string
  phone: string
  wechat?: string
  address: string
  area: string
  tags: string
}
