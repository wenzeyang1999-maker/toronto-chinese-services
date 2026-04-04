export type ServiceCategory =
  | 'moving'
  | 'cleaning'
  | 'ride'
  | 'renovation'
  | 'cashwork'
  | 'food'
  | 'other'

export interface Location {
  lat: number
  lng: number
  address: string
  city: string
  area?: string
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
  joinedAt: string
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
  maxDistance?: number
  minRating?: number
  priceType?: string
  sortBy: 'distance' | 'rating' | 'newest' | 'price'
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
