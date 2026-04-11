// ─── Match & Email Providers ──────────────────────────────────────────────────
// Given an inquiry, finds up to 5 matching service providers (by category,
// sorted by rating) and sends each one an email notification.
//
// Rules:
//  - Only providers with available = true services in the requested category
//  - Deduplicated by provider (one email per provider even if multiple services)
//  - Sorted by rating DESC
//  - If ≥ 5 matches → send to top 5; if < 5 → send to all
import { supabase } from './supabase'
import { notifyProviderInquiry } from './notify'

export interface InquiryInput {
  inquiryId:     string
  categoryId:    string
  categoryLabel: string
  description:   string
  budget:        string
  timing:        string   // 'asap' | 'flexible' | 'next_week'
  name:          string
  phone:         string
  wechat:        string
}

export interface MatchResult {
  sent:  number   // how many emails were dispatched
  total: number   // how many unique matching providers were found
}

const TIMING_LABEL: Record<string, string> = {
  asap:      '尽快（越快越好）',
  flexible:  '时间灵活',
  next_week: '下周内',
}

const MAX_RECIPIENTS = 5

export async function matchAndEmailProviders(inquiry: InquiryInput): Promise<MatchResult> {
  // ── 1. Fetch providers who have an available service in this category ────────
  const { data: rows, error } = await supabase
    .from('services')
    .select('provider_id, provider:provider_id(id, name, email, last_seen_at), reviews(rating)')
    .eq('category_id', inquiry.categoryId)
    .eq('is_available', true)

  if (error) {
    console.warn('[matchAndEmail] query failed:', error.message)
    return { sent: 0, total: 0 }
  }
  if (!rows?.length) return { sent: 0, total: 0 }

  // ── 2. Deduplicate by provider_id ────────────────────────────────────────────
  const seen = new Set<string>()
  const providers: { id: string; name: string; email: string; rating: number; activeRecently: boolean }[] = []

  const cutoff = Date.now() - 24 * 60 * 60 * 1000  // 24h ago

  for (const row of rows) {
    const p = Array.isArray((row as any).provider)
      ? (row as any).provider[0]
      : (row as any).provider
    if (!p?.email || seen.has(p.id)) continue
    seen.add(p.id)
    const reviews: { rating: number }[] = (row as any).reviews ?? []
    const rating = reviews.length
      ? reviews.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / reviews.length
      : 0
    const activeRecently = p.last_seen_at ? new Date(p.last_seen_at).getTime() > cutoff : false
    providers.push({ id: p.id, name: p.name, email: p.email, rating, activeRecently })
  }

  const total = providers.length
  if (total === 0) return { sent: 0, total: 0 }

  // ── 3. Sort: 24h active first, then by rating DESC ───────────────────────────
  providers.sort((a, b) => {
    if (a.activeRecently !== b.activeRecently) return a.activeRecently ? -1 : 1
    return b.rating - a.rating
  })
  const targets = total >= MAX_RECIPIENTS ? providers.slice(0, MAX_RECIPIENTS) : providers

  // ── 4. Fire emails in parallel (fire-and-forget, no throws) ─────────────────
  await Promise.all(
    targets.map((p) =>
      notifyProviderInquiry({
        recipientEmail: p.email,
        recipientName:  p.name,
        customerName:   inquiry.name,
        phone:          inquiry.phone,
        wechat:         inquiry.wechat || '未提供',
        categoryLabel:  inquiry.categoryLabel,
        description:    inquiry.description,
        budget:         inquiry.budget || '未指定',
        timing:         TIMING_LABEL[inquiry.timing] ?? inquiry.timing,
      })
    )
  )

  // ── 5. Record match results ───────────────────────────────────────────────────
  await supabase.from('inquiry_matches').insert(
    targets.map((p) => ({
      inquiry_id:     inquiry.inquiryId,
      provider_id:    p.id,
      provider_name:  p.name,
      provider_email: p.email,
      email_sent:     true,
    }))
  )

  return { sent: targets.length, total }
}
