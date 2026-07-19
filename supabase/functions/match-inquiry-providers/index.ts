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

// Cold-start mode:供给还少时跳过「抢单」竞争,直接把匹配到的前 ≤DIRECT_LIMIT 家
// 锁定为接单商家,双方立即互通联系方式。等商家密度上来,把 DIRECT_DISPATCH 翻成
// false 即可恢复"抢单先到先得"(RPC / 名额逻辑全保留)。
const DIRECT_DISPATCH = true
const DIRECT_LIMIT = 5

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
  isUrgent?: boolean
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
  const urgent = data.isUrgent === true
  // Urgent: NO contact hand-off. The merchant reaches the customer only via
  // in-app chat; the customer decides what to share. Direct-dispatch (normal):
  // top-5 exchange contact. Race mode: invite them to "抢单".
  const cta = urgent
    ? {
        line: '客户把紧急需求发给了正在「上线接单」的商家，<strong>请尽快登录，通过站内私信联系 TA</strong>：',
        note: '🚨 紧急单！请尽快登录 App 私信客户。出于隐私保护，联系方式与位置由客户在聊天中自行决定是否提供。',
        btn: '登录并私信客户',
        href: `${SITE}/`,
      }
    : DIRECT_DISPATCH
    ? {
        line: '您已被匹配到这条需求，<strong>可直接查看客户联系方式并主动联系 TA</strong>：',
        note: '📩 客户已收到通知，知道需求发给了包括您在内的几位服务商。请尽快联系，先联系先得。',
        btn: '查看客户联系方式',
        href: `${SITE}/profile?section=claimed_inquiries`,
      }
    : {
        line: '登录抢单，<strong>客户选定您后即可获得联系方式</strong>：',
        note: '⚡ 先到先得！最多 5 名服务商可抢到此单。抢单后若被客户选中，即可看到客户联系方式。',
        btn: '🔥 立即抢单',
        href: `${SITE}/inquiries/${h(data.inquiryId)}/claim`,
      }
  return {
    subject: urgent
      ? `🚨 紧急！有客户急需「${h(data.categoryLabel)}」服务`
      : `🔔 有客户正在寻找「${h(data.categoryLabel)}」服务`,
    html: `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#e63946,#c1121f);padding:28px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">华邻</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">海外华人生活一站式服务平台</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="font-size:17px;font-weight:700;color:#111827;margin:0 0 20px;">您有一条新的客户询价</p>
      <p>您好 <strong>${h(recipientName)}</strong>，</p>
      <p>有客户通过平台发布了一条服务需求，与您提供的「<strong>${h(data.categoryLabel)}</strong>」服务匹配。${cta.line}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
        <tr style="background:#f9fafb;"><td style="padding:10px 14px;color:#6b7280;width:90px;font-weight:600;">服务类型</td><td style="padding:10px 14px;color:#111827;">${h(data.categoryLabel)}</td></tr>
        <tr><td style="padding:10px 14px;color:#6b7280;font-weight:600;">需求描述</td><td style="padding:10px 14px;color:#374151;">${h(data.description)}</td></tr>
        <tr style="background:#f9fafb;"><td style="padding:10px 14px;color:#6b7280;font-weight:600;">预算</td><td style="padding:10px 14px;color:#111827;">${data.budget ? `$${h(data.budget)}` : '未指定'}</td></tr>
        <tr><td style="padding:10px 14px;color:#6b7280;font-weight:600;">希望时间</td><td style="padding:10px 14px;color:#111827;">${h(data.timing)}</td></tr>
      </table>
      <p style="color:#6b7280;font-size:13px;">${cta.note}</p>
      <a href="${cta.href}" style="display:inline-block;margin-top:8px;background:#e63946;color:#fff !important;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px;">${cta.btn}</a>
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

    // Auth: the caller must own this inquiry (else anyone could trigger a
    // dispatch to real merchants for an arbitrary inquiry, or hijack it).
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const authHeader = req.headers.get('Authorization') ?? ''
    let callerId: string | null = null
    if (anonKey && authHeader) {
      const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
      const { data: { user } } = await userClient.auth.getUser()
      callerId = user?.id ?? null
    }
    if (!callerId) {
      return new Response(JSON.stringify({ error: 'not_authenticated' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Verify inquiry exists and has not been matched already (prevents duplicate sends)
    // Use precise_lat/lng for accurate matching (service role bypasses the B7
    // column revoke); fall back to the blurred lat/lng for older rows.
    const { data: inquiry, error: inquiryError } = await admin
      .from('inquiries')
      .select('id, status, lat, lng, precise_lat, precise_lng, user_id, category_id')
      .eq('id', payload.inquiryId)
      .single()
    if (inquiryError || !inquiry) throw new Error('Inquiry not found')
    if (inquiry.user_id !== callerId) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    if (inquiry.status === 'matched' || (inquiry as any).race_status === 'filled') {
      return new Response(JSON.stringify({ sent: 0, total: 0, skipped: 'already_matched' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { data: rows, error } = await admin
      .from('services')
      .select('provider_id, lat, lng, provider:provider_id(id, name, email, last_seen_at, is_online), reviews(rating)')
      .eq('category_id', (inquiry as { category_id?: string }).category_id ?? payload.categoryId)
      .eq('is_available', true)

    if (error || !rows?.length) {
      return new Response(JSON.stringify({ sent: 0, total: 0 }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Straight-line distance (km) between the customer and a provider's service.
    const iLat = typeof inquiry.precise_lat === 'number' ? inquiry.precise_lat
               : typeof inquiry.lat === 'number' ? inquiry.lat : null
    const iLng = typeof inquiry.precise_lng === 'number' ? inquiry.precise_lng
               : typeof inquiry.lng === 'number' ? inquiry.lng : null
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

    // 紧急单：只发给「上线接单」(is_online) 的商家，且全部通知（不止 top5，上限
    // MAX_NOTIFY 兜底防炸）。普通单：direct-dispatch 取 top ≤5；抢单模式取 MAX_NOTIFY。
    const isUrgent = payload.isUrgent === true
    const targets = isUrgent
      ? providers.filter((p) => p.isOnline).slice(0, MAX_NOTIFY)
      : providers.slice(0, DIRECT_DISPATCH ? DIRECT_LIMIT : MAX_NOTIFY)

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
      if (isUrgent) {
        // 紧急单：绝不预授权联系方式（安全）。只通知在线商家，他们通过站内私信
        // 联系客户；联系方式/位置由客户在聊天里自行决定是否提供。通知/邮件都不带
        // 客户电话微信，link 指向公开需求帖 → 「联系」即发起站内会话。
        const { data: sr } = await admin
          .from('service_requests')
          .select('id')
          .eq('inquiry_id', payload.inquiryId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const link = sr?.id ? `/requests/${sr.id}` : '/'
        await admin.from('notifications').insert(
          targets.map((provider) => ({
            recipient_id: provider.id,
            type:  'new_inquiry_lead',
            title: '🚨 紧急需求！客户急需服务',
            body:  `客户急需「${payload.categoryLabel}」，点开私信联系 TA（联系方式由客户决定是否提供）`,
            link_url: link,
          }))
        )
        // 不动 accepted_provider_ids / race_status —— 不发放任何联系方式。
      } else if (DIRECT_DISPATCH) {
        // Auto-assign the matched providers — both sides get contact immediately,
        // no grab step. race_status='filled' also blocks a duplicate re-dispatch.
        await admin.from('inquiries').update({
          accepted_provider_ids: targets.map((p) => p.id),
          race_status: 'filled',
        }).eq('id', payload.inquiryId)

        // In-app lead notification to each matched merchant (they also got email).
        await admin.from('notifications').insert(
          targets.map((provider) => ({
            recipient_id: provider.id,
            type:  'new_inquiry_lead',
            title: '匹配到一条新客户需求',
            body:  `客户在找「${payload.categoryLabel}」服务，点开查看联系方式并主动联系`,
            link_url: '/profile?section=claimed_inquiries',
          }))
        )
      } else {
        // Race mode: open the slots, providers compete to claim.
        await admin.from('inquiries').update({ race_status: 'open' }).eq('id', payload.inquiryId)
      }
    }

    // Reassure the customer — ALWAYS fire, even with 0 matches, so a posted
    // inquiry never feels like it vanished into the void.
    const customerId = (inquiry as { user_id?: string }).user_id
    if (customerId) {
      await admin.from('notifications').insert(
        targets.length > 0
          ? {
              recipient_id: customerId,
              type:  'inquiry_dispatched',
              title: isUrgent
                ? `🚨 紧急需求已发给 ${targets.length} 位在线商家`
                : `询价已发给 ${targets.length} 位商家`,
              body:  isUrgent
                ? '在线商家已收到紧急提醒，会通过站内消息联系你，请留意「我的消息」'
                : '他们会尽快主动联系你；急的话也可点这里查看这几家、自己先联系',
              link_url: isUrgent ? '/profile?section=messages' : '/profile?section=inquiries',
            }
          : {
              recipient_id: customerId,
              type:  'inquiry_dispatched',
              title: '需求已收到',
              body:  isUrgent
                ? '暂时没有在线商家，需求已记录；可稍后再试或改为普通发布'
                : '暂时没有匹配到合适的商家，你可以直接浏览服务、主动联系',
              link_url: '/',
            }
      )
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
