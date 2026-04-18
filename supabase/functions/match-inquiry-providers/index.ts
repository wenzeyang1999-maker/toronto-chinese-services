import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FROM = 'Toronto-Chinese-Service <noreply@huarenq.com>'
const SITE = 'https://toronto-chinese-services.vercel.app'
const MAX_RECIPIENTS = 5

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

interface ProviderRow {
  provider_id: string
  provider: {
    id: string
    name: string | null
    email: string | null
    last_seen_at: string | null
  } | null
  reviews: { rating: number }[] | null
}

function buildProviderInquiryEmail(recipientName: string, data: InquiryPayload) {
  return {
    subject: `🔔 有客户正在寻找「${data.categoryLabel}」服务`,
    html: `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#e63946,#c1121f);padding:28px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">大多伦多华人服务</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Toronto Chinese Services</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="font-size:17px;font-weight:700;color:#111827;margin:0 0 20px;">您有一条新的客户询价</p>
      <p>您好 <strong>${recipientName}</strong>，</p>
      <p>有客户通过平台发布了一条服务需求，与您提供的「<strong>${data.categoryLabel}</strong>」服务匹配，请及时联系客户：</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
        <tr style="background:#f9fafb;"><td style="padding:10px 14px;color:#6b7280;width:90px;font-weight:600;">客户姓名</td><td style="padding:10px 14px;color:#111827;">${data.name}</td></tr>
        <tr><td style="padding:10px 14px;color:#6b7280;font-weight:600;">联系电话</td><td style="padding:10px 14px;color:#111827;font-weight:700;">${data.phone}</td></tr>
        <tr style="background:#f9fafb;"><td style="padding:10px 14px;color:#6b7280;font-weight:600;">微信号</td><td style="padding:10px 14px;color:#111827;">${data.wechat || '未提供'}</td></tr>
        <tr><td style="padding:10px 14px;color:#6b7280;font-weight:600;">服务类型</td><td style="padding:10px 14px;color:#111827;">${data.categoryLabel}</td></tr>
        <tr style="background:#f9fafb;"><td style="padding:10px 14px;color:#6b7280;font-weight:600;">需求描述</td><td style="padding:10px 14px;color:#374151;">${data.description}</td></tr>
        <tr><td style="padding:10px 14px;color:#6b7280;font-weight:600;">预算</td><td style="padding:10px 14px;color:#111827;">${data.budget ? `$${data.budget}` : '未指定'}</td></tr>
        <tr style="background:#f9fafb;"><td style="padding:10px 14px;color:#6b7280;font-weight:600;">希望时间</td><td style="padding:10px 14px;color:#111827;">${data.timing}</td></tr>
      </table>
      <p style="color:#6b7280;font-size:13px;">⚡ 建议尽快联系客户，先到先得！同类服务商也可能收到此通知。</p>
      <a href="${SITE}" style="display:inline-block;margin-top:8px;background:#e63946;color:#fff !important;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px;">登录平台查看更多询价</a>
    </div>
  </div>
</body>
</html>`,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!url || !serviceRoleKey) throw new Error('Supabase service role not configured')
    if (!resendApiKey) throw new Error('RESEND_API_KEY not set')

    const payload = await req.json() as InquiryPayload
    if (!payload.inquiryId || !payload.categoryId || !payload.name || !payload.phone) {
      return new Response(JSON.stringify({ error: 'missing fields' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(url, serviceRoleKey)

    const { data: inquiry, error: inquiryError } = await admin
      .from('inquiries')
      .select('id')
      .eq('id', payload.inquiryId)
      .single()
    if (inquiryError || !inquiry) throw new Error('Inquiry not found')

    const { data: rows, error } = await admin
      .from('services')
      .select('provider_id, provider:provider_id(id, name, email, last_seen_at), reviews(rating)')
      .eq('category_id', payload.categoryId)
      .eq('is_available', true)

    if (error || !rows?.length) {
      return new Response(JSON.stringify({ sent: 0, total: 0 }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const seen = new Set<string>()
    const providers: { id: string; name: string; email: string; rating: number; activeRecently: boolean }[] = []
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
      const activeRecently = provider.last_seen_at
        ? new Date(provider.last_seen_at).getTime() > cutoff
        : false
      providers.push({
        id: provider.id,
        name: provider.name ?? '用户',
        email: provider.email,
        rating,
        activeRecently,
      })
    }

    providers.sort((a, b) => {
      if (a.activeRecently !== b.activeRecently) return a.activeRecently ? -1 : 1
      return b.rating - a.rating
    })

    const targets = providers.slice(0, MAX_RECIPIENTS)

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
      await admin.from('inquiries').update({ status: 'matched' }).eq('id', payload.inquiryId)
    }

    return new Response(JSON.stringify({ sent: targets.length, total: providers.length }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('match-inquiry-providers error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
