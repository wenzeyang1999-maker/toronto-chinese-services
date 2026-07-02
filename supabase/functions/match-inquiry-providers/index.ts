import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const ALLOWED_ORIGINS = new Set([
  'https://toronto-chinese-services.vercel.app',
  'https://huarenq.com',
  'https://www.huarenq.com',
  'http://localhost:5173',
  'http://localhost:4173',
])

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin)
    ? origin
    : 'https://toronto-chinese-services.vercel.app'
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

const FROM = 'HuaLin <noreply@huarenq.com>'
const SITE = 'https://toronto-chinese-services.vercel.app'
// Race mode: notify all matching providers, they race to claim the first 5 slots.
const MAX_NOTIFY = 20

// Escape user-supplied strings before interpolating them into the email HTML.
// Without this, a malicious inquiry description like `<img src=x onerror=...>`
// would render (and possibly execute) in the recipient's email client.
function h(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface InquiryPayload {
  inquiryId: string
  categoryId: string
  categoryLabel: string
  description: string
  budget: string
  timing: string
  name: string
  phone: string
  wechat: string
}

// TODO (Plan B — 5-person racing mechanic):
// Replace auto-match with Supabase Realtime broadcast to ALL matching providers.
// Build a PostgreSQL RPC with row-level lock: only the first 5 providers who
// click "抢单" get written into accepted_provider_ids[]. After 5 acceptances,
// the RPC stops writes and the broadcast channel is closed. Client then sees
// the 5 winners' cards and picks 1. Requires: provider-side accept UI,
// orders.accepted_provider_ids uuid[] column, and a concurrency-safe RPC.

interface ProviderRow {
  provider_id: string
  provider: {
    id: string
    name: string | null
    email: string | null
    last_seen_at: string | null
    is_online: boolean | null
  } | null
  reviews: { rating: number }[] | null
}

function buildProviderInquiryEmail(recipientName: string, data: InquiryPayload) {
  return {
    subject: `🔔 有客户正在寻找「${h(data.categoryLabel)}」服务`,
    html: `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#e63946,#c1121f);padding:28px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">华林</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">海外华人生活一站式服务平台</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="font-size:17px;font-weight:700;color:#111827;margin:0 0 20px;">您有一条新的客户询价</p>
      <p>您好 <strong>${h(recipientName)}</strong>，</p>
      <p>有客户通过平台发布了一条服务需求，与您提供的「<strong>${h(data.categoryLabel)}</strong>」服务匹配。登录抢单，<strong>客户选定您后即可获得联系方式</strong>：</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
        <tr style="background:#f9fafb;"><td style="padding:10px 14px;color:#6b7280;width:90px;font-weight:600;">服务类型</td><td style="padding:10px 14px;color:#111827;">${h(data.categoryLabel)}</td></tr>
        <tr><td style="padding:10px 14px;color:#6b7280;font-weight:600;">需求描述</td><td style="padding:10px 14px;color:#374151;">${h(data.description)}</td></tr>
        <tr style="background:#f9fafb;"><td style="padding:10px 14px;color:#6b7280;font-weight:600;">预算</td><td style="padding:10px 14px;color:#111827;">${data.budget ? `$${h(data.budget)}` : '未指定'}</td></tr>
        <tr><td style="padding:10px 14px;color:#6b7280;font-weight:600;">希望时间</td><td style="padding:10px 14px;color:#111827;">${h(data.timing)}</td></tr>
      </table>
      <p style="color:#6b7280;font-size:13px;">⚡ 先到先得！最多 5 名服务商可抢到此单。抢单后若被客户选中，即可看到客户联系方式。</p>
      <a href="${SITE}/inquiries/${h(data.inquiryId)}/claim" style="display:inline-block;margin-top:8px;background:#e63946;color:#fff !important;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px;">🔥 立即抢单</a>
    </div>
  </div>
</body>
</html>`,
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const cors   = corsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!url || !serviceRoleKey) throw new Error('Supabase service role not configured')
    if (!resendApiKey) throw new Error('RESEND_API_KEY not set')

    const payload = await req.json() as InquiryPayload
    if (!payload.inquiryId || !payload.categoryId || !payload.name || !payload.phone) {
      return new Response(JSON.stringify({ error: 'missing fields' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(url, serviceRoleKey)

    // Verify inquiry exists and has not been matched already (prevents duplicate sends)
    const { data: inquiry, error: inquiryError } = await admin
      .from('inquiries')
      .select('id, status, lat, lng')
      .eq('id', payload.inquiryId)
      .single()
    if (inquiryError || !inquiry) throw new Error('Inquiry not found')
    if (inquiry.status === 'matched' || (inquiry as any).race_status === 'filled') {
      return new Response(JSON.stringify({ sent: 0, total: 0, skipped: 'already_matched' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { data: rows, error } = await admin
      .from('services')
      .select('provider_id, lat, lng, provider:provider_id(id, name, email, last_seen_at, is_online), reviews(rating)')
      .eq('category_id', payload.categoryId)
      .eq('is_available', true)

    if (error || !rows?.length) {
      return new Response(JSON.stringify({ sent: 0, total: 0 }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Straight-line distance (km) between the customer and a provider's service.
    const iLat = typeof inquiry.lat === 'number' ? inquiry.lat : null
    const iLng = typeof inquiry.lng === 'number' ? inquiry.lng : null
    function distanceKm(lat: number | null, lng: number | null): number | null {
      if (iLat === null || iLng === null || typeof lat !== 'number' || typeof lng !== 'number') return null
      if ((lat === 0 && lng === 0)) return null
      const R = 6371, toRad = (d: number) => (d * Math.PI) / 180
      const dLat = toRad(lat - iLat), dLng = toRad(lng - iLng)
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(iLat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    const seen = new Set<string>()
    const providers: { id: string; name: string; email: string; rating: number; isOnline: boolean; activeRecently: boolean; distance: number | null }[] = []
    const cutoff = Date.now() - 24 * 60 * 60 * 1000

    for (const row of rows as ProviderRow[]) {
      const provider = Array.isArray((row as unknown as { provider: ProviderRow['provider'][] }).provider)
        ? (row as unknown as { provider: ProviderRow['provider'][] }).provider[0]
        : row.provider
      if (!provider?.email || seen.has(provider.id)) continue
      seen.add(provider.id)
      const reviews = row.reviews ?? []
      const rating = reviews.length
        ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length
        : 0
      const isOnline = provider.is_online === true
      const activeRecently = provider.last_seen_at
        ? new Date(provider.last_seen_at).getTime() > cutoff
        : false
      providers.push({
        id: provider.id,
        name: provider.name ?? '用户',
        email: provider.email,
        rating,
        isOnline,
        activeRecently,
        distance: distanceKm((row as { lat: number | null }).lat, (row as { lng: number | null }).lng),
      })
    }

    // Sort priority: 1) is_online 2) active 24h 3) NEARBY first (unknown-distance
    // last, so a far/no-coord provider drops off the MAX_NOTIFY list when closer
    // ones exist) 4) rating. Soft geo — never hard-excludes.
    providers.sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1
      if (a.activeRecently !== b.activeRecently) return a.activeRecently ? -1 : 1
      const ad = a.distance, bd = b.distance
      if (ad !== bd) {
        if (ad === null) return 1
        if (bd === null) return -1
        if (Math.abs(ad - bd) > 1) return ad - bd   // >1km apart → nearer first
      }
      return b.rating - a.rating
    })

    // Race mode: notify all providers (up to MAX_NOTIFY), they click "抢单" to claim.
    const targets = providers.slice(0, MAX_NOTIFY)

    await Promise.all(targets.map(async (provider) => {
      const email = buildProviderInquiryEmail(provider.name, payload)
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM,
          to: [provider.email],
          subject: email.subject,
          html: email.html,
        }),
      })
    }))

    if (targets.length > 0) {
      await admin.from('inquiry_matches').insert(
        targets.map((provider) => ({
          inquiry_id: payload.inquiryId,
          provider_id: provider.id,
          provider_name: provider.name,
          provider_email: provider.email,
          email_sent: true,
        }))
      )
      // Set race_status = 'open' (not immediately 'matched' — providers race to fill slots)
      await admin.from('inquiries').update({ race_status: 'open' }).eq('id', payload.inquiryId)
    }

    return new Response(JSON.stringify({ sent: targets.length, total: providers.length }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('match-inquiry-providers error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
