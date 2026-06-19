import type { MemberLevel } from '../../components/MembershipBadge/MembershipBadge'

export interface ProviderUser {
  id: string
  name: string
  avatar_url: string | null
  email: string
  phone: string | null
  wechat: string | null
  bio: string | null
  is_email_verified: boolean
  phone_verified: boolean
  social_links: Record<string, string>
  created_at: string
  membership_level: MemberLevel
  business_verified: boolean
  avg_reply_hours: number | null
  last_seen_at: string | null
  is_online: boolean
  business_type: 'individual' | 'business'
  skill_tags: string[]
  qualification_note: string
  qualification_images: string[]
  credit_penalty: number
}

export interface ProviderReview {
  id: string
  rating: number
  comment: string | null
  created_at: string
  service: { id: string; title: string } | null
  reviewer: { id: string; name: string; avatar_url: string | null } | null
  reply: string | null
}

export interface ServiceRow {
  id: string
  title: string
  description: string
  category_id: string
  price: number | null
  price_type: string | null
  area: string | null
  images: string[]
  avgRating: number | null
  reviewCount: number
}
