// ── Content Moderation Edge Function ─────────────────────────────────────────
// POST { text: string }
// Returns { pass: boolean, reason?: string }
// Uses Groq llama-3 for fast, cheap classification.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { allowAiCallByUser } from '../_shared/aiRateLimit.ts'

const RL_MAX    = 60              // moderations per user per window (called on each publish)
const RL_WINDOW = 10 * 60 * 1000  // 10 minutes

const ALLOWED_ORIGINS = new Set([
  'https://toronto-chinese-services.vercel.app',
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

const SYSTEM_PROMPT = `你是一个内容审核 AI，专门为加拿大多伦多华人生活服务平台服务。

只允许通过与以下合法生活服务相关的内容：
- 搬家、保洁、装修、接送、餐饮、家政等日常生活服务
- 合法的二手交易、租房、招聘
- 社区活动、经验分享

必须拒绝（返回 pass:false）的内容：
1. 政治内容：涉及中国大陆/台湾/香港政治、两岸关系、领导人批评、反政府/反华言论、政党宣传、抗议游行、示威
2. 敏感话题：新疆、西藏、六四、法轮功、台独/港独/藏独等政治敏感议题
3. 违法内容：毒品、武器、色情、赌博、诈骗、非法移民中介
4. 仇恨言论：种族歧视、地域攻击、人身攻击、骚扰、辱骂
5. 血腥暴力：血腥、暴力、虐待、自残自杀、恐怖惊悚、令人极度不适的描述
6. 恶俗低俗：低俗、色情擦边、性暗示、粗俗脏话、恶意引战、人身羞辱
7. 虚假医疗：声称能治愈疾病的偏方、无牌医疗服务

如果内容是正常的生活服务广告、社区帖子、需求发布，直接通过。
对于模糊的内容，宁可通过（false positive 代价低）。

只返回 JSON，格式严格如下，不要有任何其他文字：
{"pass":true} 或 {"pass":false,"reason":"具体原因（中文，15字以内）"}`

const IMAGE_PROMPT = `你是图片内容安全审核 AI，服务于海外华人生活服务平台。判断这张用户上传的图片是否含有以下必须拒绝的内容：
1. 色情、裸露、性暗示、擦边低俗
2. 血腥、暴力、伤口、虐待、尸体、极度不适画面
3. 恐怖、惊悚、恶心
4. 明显违法（毒品、武器展示等）

这是生活服务平台，正常图片一律通过：服务/施工照片、商品照、二手物品、家居、车辆、食物、风景、正常人物/生活照、证件（如驾照打码后）等。
只在明确含上述违规内容时才拒绝；模糊或不确定时通过（宁可放行，false positive 代价高）。
不要评判政治内容（图片政治判断不可靠，交由人工/举报处理）。

只返回 JSON，格式严格如下，不要有任何其他文字：
{"pass":true} 或 {"pass":false,"reason":"具体原因（中文，10字以内）"}`

async function requireAuth(req: Request): Promise<string> {
  const url     = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anonKey) throw new Error('Supabase env missing')
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Unauthorized')
  return data.user.id
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const cors   = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const uid = await requireAuth(req)
    if (!(await allowAiCallByUser(uid, 'moderate-content', RL_MAX, RL_WINDOW))) {
      return new Response(JSON.stringify({ error: '操作过于频繁，请稍后再试' }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json() as { text?: string; imageDataUrl?: string }

    // ── 图片审核分支（qwen 视觉，判黄暴血腥；客户端已缩成 ~512px 缩略图）──────────
    if (body.imageDataUrl) {
      const apiKey = Deno.env.get('GROQ_API_KEY')
      if (!apiKey) {
        return new Response(JSON.stringify({ pass: true, deferred: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
      }
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          signal: AbortSignal.timeout(15_000),   // 视觉推理略慢
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model:       'qwen/qwen3.6-27b',   // Groq 多模态（可看图）
            max_tokens:  128,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: IMAGE_PROMPT },
              { role: 'user', content: [
                { type: 'text', text: '审核这张用户上传的图片，只返回 JSON。' },
                { type: 'image_url', image_url: { url: body.imageDataUrl } },
              ] },
            ],
          }),
        })
        if (!res.ok) {
          console.error('Groq vision error:', res.status)
          // 限流/出错 → fail-open 放行，但标记 deferred，让客户端入队稍后补审
          return new Response(JSON.stringify({ pass: true, deferred: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
        }
        const data = await res.json()
        const raw  = data.choices?.[0]?.message?.content?.trim() ?? '{}'
        let result: { pass: boolean; reason?: string }
        try { result = JSON.parse(raw) } catch { result = { pass: true } }
        return new Response(JSON.stringify(result), { headers: { ...cors, 'Content-Type': 'application/json' } })
      } catch (e) {
        console.error('vision moderation error:', e)
        return new Response(JSON.stringify({ pass: true, deferred: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })   // fail open + defer
      }
    }

    // ── 文字审核分支 ────────────────────────────────────────────────────────────
    const text = body.text ?? ''
    if (!text?.trim()) {
      return new Response(JSON.stringify({ pass: true }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('GROQ_API_KEY')
    if (!apiKey) throw new Error('GROQ_API_KEY not configured')

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(8_000),
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'llama-3.1-8b-instant',   // fast + cheap for moderation
        max_tokens:  64,
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: text.slice(0, 2000) },  // cap input
        ],
      }),
    })

    if (!res.ok) {
      // Fail open: if Groq is down, don't block users
      console.error('Groq error:', res.status)
      return new Response(JSON.stringify({ pass: true }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
    const raw  = data.choices?.[0]?.message?.content?.trim() ?? '{}'

    let result: { pass: boolean; reason?: string }
    try {
      result = JSON.parse(raw)
    } catch {
      result = { pass: true }  // parse fail → fail open
    }

    return new Response(JSON.stringify(result), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'Unauthorized') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    // Fail open for all other errors so a Groq outage doesn't block all publishing
    console.error('moderate-content error:', err)
    return new Response(JSON.stringify({ pass: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
