// ─── Real Estate Module — Type Definitions ────────────────────────────────────

export type RealEstateListingType = 'rent' | 'sale' | 'shared'
export type PropertyType = 'apartment' | 'house' | 'townhouse' | 'condo' | 'basement' | 'room' | 'other'
export type PriceType = 'monthly' | 'total' | 'negotiable'

export interface PropertyPoster {
  id: string
  name: string
  avatar_url: string | null
}

export interface Property {
  id: string
  poster_id: string
  poster?: PropertyPoster

  listing_type: RealEstateListingType
  title: string
  property_type: PropertyType
  bedrooms: number | null
  bathrooms: number | null
  description: string

  price: number | null
  price_type: PriceType

  pet_friendly: boolean
  parking: boolean
  utilities_included: boolean

  images: string[]

  area: string[] | null
  city: string
  address: string | null

  available_date: string | null

  contact_name: string
  contact_phone: string
  contact_wechat: string | null

  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RealEstateFilters {
  listing_type?: RealEstateListingType
  keyword?: string
  property_type?: PropertyType
  area?: string
  max_price?: number
  bedrooms?: number
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export const LISTING_TYPE_CONFIG: Record<RealEstateListingType, { label: string; color: string }> = {
  rent:   { label: '出租', color: 'bg-blue-100 text-blue-700' },
  sale:   { label: '出售', color: 'bg-red-100 text-red-700' },
  shared: { label: '合租', color: 'bg-purple-100 text-purple-700' },
}

export const PROPERTY_TYPE_CONFIG: Record<PropertyType, { label: string; emoji: string }> = {
  apartment: { label: '公寓',   emoji: '🏢' },
  condo:     { label: '共管公寓', emoji: '🏙️' },
  house:     { label: '独立屋', emoji: '🏠' },
  townhouse: { label: '联排别墅', emoji: '🏘️' },
  basement:  { label: '地下室', emoji: '🏚️' },
  room:      { label: '单间',   emoji: '🛏️' },
  other:     { label: '其他',   emoji: '📦' },
}

export const PRICE_TYPE_LABEL: Record<PriceType, string> = {
  monthly:    '/ 月',
  total:      '总价',
  negotiable: '面议',
}

export function getPriceLabel(p: Pick<Property, 'price' | 'price_type'>): string {
  if (p.price_type === 'negotiable') return '价格面议'
  if (p.price == null) return '价格面议'
  if (p.price_type === 'monthly') return `$${p.price.toLocaleString()} / 月`
  return `$${p.price.toLocaleString()}`
}

export function getBedroomLabel(bedrooms: number | null): string {
  if (bedrooms === null) return ''
  if (bedrooms === 0) return 'Studio'
  return `${bedrooms} 卧`
}
