// check-service-match(内测2-#9,软提示版): 判断服务商要发的服务贴是否与其
// 「业务名片」(姓名/简介/技能标签/已发类目)大致相符。仅用于前端**软提示**,
// 绝不硬拦:任何异常一律 fail-open 返回 match:true。
import { allowAiCall } from '../_shared/aiRateLimit.ts'

const RL_MAX    = 30
const RL_WINDOW = 10 * 60 * 1000

const ALLOWED_ORIGINS = new Set([
  'https://toronto-chinese-services.vercel.app',
  'https://hualinlife.com',
  'https://www.hualinlife.com',
  'http://localhost:5173',
  'http://localhost:4173',
])

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://hualinlife.com'
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

const SYSTEM_PROMPT = `你是华邻平台的服务发布一致性检查助手。给你一个服务商的「业务名片」和他这次要发布的「服务贴」，判断这条服务是否与他的主营业务大致相符。

判断从宽(海外华人服务商常身兼多职,相关/相邻的都算相符):
- 搬家↔搬运↔清洁↔除雪↔垃圾清运↔handyman 这类体力/家政服务彼此算相符
- 只有当服务贴与名片主营明显不搭(如名片是「搬家」却发「钢琴教学/报税/律师」)才判不相符
- 名片信息很少/为空时,一律判相符(无法判断就放行)

只返回 JSON：{"match":true} 或 {"match":false,"reason":"一句话说明为何不符(中文,20字内)"}`

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const cors   = corsHeaders(origin)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })

  const jsonRes = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (!(await allowAiCall(req, 'check-service-match', RL_MAX, RL_WINDOW))) {
    return jsonRes({ match: true })   // 限流也放行(软提示不该挡人)
  }

  try {
    const body = await req.json() as { profile?: string; service?: string }
    const profile = String(body.profile ?? '').slice(0, 800).trim()
    const service = String(body.service ?? '').slice(0, 800).trim()
    if (!profile || !service) return jsonRes({ match: true })   // 信息不足 → 放行

    const apiKey = Deno.env.get('GROQ_API_KEY')
    if (!apiKey) return jsonRes({ match: true })

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0,
        max_tokens: 120,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: `【业务名片】\n${profile}\n\n【要发布的服务贴】\n${service}` },
        ],
      }),
    })
    if (!res.ok) return jsonRes({ match: true })

    const data = await res.json()
    const raw  = data.choices?.[0]?.message?.content ?? '{}'
    let parsed: { match?: boolean; reason?: string }
    try { parsed = JSON.parse(raw) } catch { return jsonRes({ match: true }) }

    // 只有明确 false 才提示,其余一律相符
    if (parsed.match === false) return jsonRes({ match: false, reason: (parsed.reason ?? '').slice(0, 40) })
    return jsonRes({ match: true })
  } catch {
    return jsonRes({ match: true })
  }
})
