// ─── Secondhand Marketplace — Type Definitions ────────────────────────────────

export type SecondhandCategory =
  | 'electronics'
  | 'furniture'
  | 'clothing'
  | 'baby'
  | 'books'
  | 'vehicle'
  | 'sports'
  | 'other'

export type ItemCondition = 'new' | 'like_new' | 'good' | 'fair'

export interface SecondhandSeller {
  id: string
  name: string
  avatar_url: string | null
}

export interface SecondhandItem {
  id: string
  seller_id: string
  seller?: SecondhandSeller

  title: string
  category: SecondhandCategory
  condition: ItemCondition
  description: string

  price: number | null
  is_free: boolean

  images: string[]

  area: string[] | null
  city: string

  contact_name: string
  contact_phone: string
  contact_wechat: string | null

  is_active: boolean
  is_sold: boolean

  created_at: string
  updated_at: string
}

export interface SecondhandFilters {
  keyword?: string
  category?: SecondhandCategory
  condition?: ItemCondition
  area?: string
  max_price?: number
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export const SECONDHAND_CATEGORY_CONFIG: Record<SecondhandCategory, { label: string; emoji: string }> = {
  electronics: { label: '电子数码', emoji: '📱' },
  furniture:   { label: '家具家电', emoji: '🛋️' },
  clothing:    { label: '服饰鞋包', emoji: '👗' },
  baby:        { label: '母婴玩具', emoji: '🧸' },
  books:       { label: '图书文具', emoji: '📚' },
  vehicle:     { label: '车辆配件', emoji: '🚗' },
  sports:      { label: '运动户外', emoji: '⛷️' },
  other:       { label: '其他',     emoji: '📦' },
}

export const ITEM_CONDITION_CONFIG: Record<ItemCondition, { label: string; color: string }> = {
  new:      { label: '全新',   color: 'bg-green-100 text-green-700' },
  like_new: { label: '九成新', color: 'bg-blue-100 text-blue-700' },
  good:     { label: '良好',   color: 'bg-yellow-100 text-yellow-700' },
  fair:     { label: '一般',   color: 'bg-gray-100 text-gray-600' },
}

export function getPriceLabel(item: Pick<SecondhandItem, 'price' | 'is_free'>): string {
  if (item.is_free) return '免费'
  if (item.price != null) return `$${item.price}`
  return '面议'
}
