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
    .select('provider_id, provider:provider_id(id, name, email, rating)')
    .eq('category', inquiry.categoryId)
    .eq('available', true)

  if (error) {
    console.warn('[matchAndEmail] query failed:', error.message)
    return { sent: 0, total: 0 }
  }
  if (!rows?.length) return { sent: 0, total: 0 }

  // ── 2. Deduplicate by provider_id ────────────────────────────────────────────
  const seen = new Set<string>()
  const providers: { id: string; name: string; email: string; rating: number }[] = []

  for (const row of rows) {
    const p = Array.isArray((row as any).provider)
      ? (row as any).provider[0]
      : (row as any).provider
    if (!p?.email || seen.has(p.id)) continue
    seen.add(p.id)
    providers.push({ id: p.id, name: p.name, email: p.email, rating: p.rating ?? 0 })
  }

  const total = providers.length
  if (total === 0) return { sent: 0, total: 0 }

  // ── 3. Sort by rating DESC, cap at MAX_RECIPIENTS if ≥ MAX ──────────────────
  providers.sort((a, b) => b.rating - a.rating)
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

  return { sent: targets.length, total }
}
