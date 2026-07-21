// ─── process-image-queue ──────────────────────────────────────────────────────
// Drains the image_review_queue: re-moderates images that were uploaded while the
// vision quota was exhausted (fail-open). On a violation → hide the content
// (flip its active flag) + notify the owner and all admins. Called by pg_cron
// with the service-role key; processes a small batch per run to respect limits.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const BATCH = 8   // images per run (respect qwen free-tier token/min)

const IMAGE_PROMPT = `你是图片内容安全审核 AI，服务于海外华人生活服务平台。判断这张用户上传的图片是否含有以下必须拒绝的内容：
1. 色情、裸露、性暗示、擦边低俗
2. 血腥、暴力、伤口、虐待、尸体、极度不适画面
3. 恐怖、惊悚、恶心
4. 明显违法（毒品、武器展示等）
这是生活服务平台，正常图片一律通过：服务/施工照片、商品照、二手物品、家居、车辆、食物、风景、正常人物/生活照等。
只在明确含上述违规内容时才拒绝；模糊或不确定时通过。不要评判政治内容。
只返回 JSON：{"pass":true} 或 {"pass":false,"reason":"具体原因（中文，10字内）"}`

// target_type → { 表, 下架字段, 归属字段 }
const TARGETS: Record<string, { table: string; flag: string; owner: string }> = {
  service:    { table: 'services',        flag: 'is_available', owner: 'provider_id' },
  secondhand: { table: 'secondhand',      flag: 'is_active',    owner: 'seller_id'   },
  property:   { table: 'properties',      flag: 'is_active',    owner: 'poster_id'   },
  event:      { table: 'events',          flag: 'is_active',    owner: 'poster_id'   },
  community:  { table: 'community_posts', flag: 'is_active',    owner: 'author_id'   },
}

async function moderateUrl(apiKey: string, url: string): Promise<{ pass: boolean; reason?: string } | null> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(20_000),
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-27b',
        max_tokens: 128,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: IMAGE_PROMPT },
          { role: 'user', content: [
            { type: 'text', text: '审核这张用户上传的图片，只返回 JSON。' },
            { type: 'image_url', image_url: { url } },
          ] },
        ],
      }),
    })
    if (res.status === 429) return null                 // 仍在限流 → 留待下次
    if (!res.ok) return { pass: true }                  // 其它错误 → 放行（本次不再重试）
    const data = await res.json()
    const raw  = data.choices?.[0]?.message?.content?.trim() ?? '{}'
    try { return JSON.parse(raw) } catch { return { pass: true } }
  } catch { return null }                               // 网络/超时 → 留待下次
}

Deno.serve(async (req) => {
  // 仅接受 service-role 调用（cron）
  const key = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!serviceKey || key !== serviceKey) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
  }
  const apiKey = Deno.env.get('GROQ_API_KEY') ?? ''
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey)

  const { data: rows } = await sb
    .from('image_review_queue')
    .select('id, user_id, image_url, target_type')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH)

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), { headers: { 'Content-Type': 'application/json' } })
  }

  let flagged = 0
  for (const row of rows) {
    const result = await moderateUrl(apiKey, row.image_url)
    if (result === null) continue   // 仍限流/超时 → 保持 pending，下次再审

    if (result.pass) {
      await sb.from('image_review_queue').update({ status: 'passed', reviewed_at: new Date().toISOString() }).eq('id', row.id)
      continue
    }

    // 命中违规 → 隐藏内容 + 通知
    flagged++
    const reason = result.reason ?? '含违规内容'
    await sb.from('image_review_queue').update({ status: 'flagged', reason, reviewed_at: new Date().toISOString() }).eq('id', row.id)

    const t = TARGETS[row.target_type]
    if (t) {
      const { data: hit } = await sb.from(t.table).select(`id, ${t.owner}`).contains('images', [row.image_url]).limit(1).maybeSingle()
      if (hit) {
        await sb.from(t.table).update({ [t.flag]: false }).eq('id', (hit as Record<string, unknown>).id)
        const ownerId = (hit as Record<string, string>)[t.owner]
        // 通知发布者
        await sb.from('notifications').insert({
          recipient_id: ownerId, type: 'content_hidden', title: '内容已被暂时下架',
          body: `你的一张图片未通过安全审核（${reason}），相关内容已暂时隐藏。如有异议请联系客服。`,
          link_url: '/profile',
        })
        // 通知所有 admin
        const { data: admins } = await sb.from('users').select('id').eq('role', 'admin')
        if (admins?.length) {
          await sb.from('notifications').insert(admins.map((a: { id: string }) => ({
            recipient_id: a.id, type: 'image_flagged', title: '补审命中违规图片',
            body: `一张图片补审未通过（${reason}），相关${row.target_type}内容已自动下架，请到后台复核。`,
            link_url: '/admin',
          })))
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: rows.length, flagged }), { headers: { 'Content-Type': 'application/json' } })
})
