// smart-search(内测#6): 把用户的自然语言搜索意图分类到某个板块 + 提取关键词，
// 前端据此跳转到对应结果页/地图。纯路由用途，不落库。
//   输入 { text }
//   输出 { domain: service|realestate|secondhand|jobs|community, keyword, urgent }
// Groq 分类;任何异常一律 fail-open 回退到 service + 原文，保证搜索永不被 AI 挡住。
import { allowAiCall } from '../_shared/aiRateLimit.ts'

const RL_MAX       = 30                // calls per IP per window
const RL_WINDOW    = 10 * 60 * 1000    // 10 minutes
const MAX_TEXT_LEN = 200

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

const DOMAINS = ['service', 'realestate', 'secondhand', 'jobs', 'community']

const SYSTEM_PROMPT = `你是华邻(海外华人生活服务平台)的智能搜索路由助手。判断用户想找什么，输出严格 JSON。

domain 取值(五选一)：
- service：找生活服务/师傅(搬家、保洁、装修、报税、接送、维修、宠物、教育、美容、法律、移民等)
- realestate：租房、买房、找房、出租、合租、房源
- secondhand：二手买卖、闲置、卖东西、收二手、转让物品
- jobs：找工作、招聘、求职、招人、职位
- community：社区帖子、同城活动、问答、交流、找人闲聊

keyword：用于搜索的核心词。去掉"我要找/附近有吗/帮我"等口语，保留品类/物品/职位/地点等关键词。
urgent：提到"急/尽快/今天/马上/现在" → true，否则 false。

只返回 JSON：{"domain":"service","keyword":"...","urgent":false}`

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const cors   = corsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })

  if (!(await allowAiCall(req, 'smart-search', RL_MAX, RL_WINDOW))) {
    return new Response(JSON.stringify({ error: '请求过于频繁，请稍后再试' }), {
      status: 429, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const jsonRes = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const body = await req.json() as { text?: string }
    const text = String(body.text ?? '').slice(0, MAX_TEXT_LEN).trim()
    if (!text) return jsonRes({ error: '请输入搜索内容' }, 400)

    // fail-open 兜底:AI 不可用时,当作普通服务关键词搜索。
    const fallback = { domain: 'service', keyword: text, urgent: false }

    const apiKey = Deno.env.get('GROQ_API_KEY')
    if (!apiKey) return jsonRes(fallback)

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
          { role: 'user',   content: text },
        ],
      }),
    })
    if (!res.ok) { console.error('smart-search Groq error', res.status); return jsonRes(fallback) }

    const data = await res.json()
    const raw  = data.choices?.[0]?.message?.content ?? '{}'
    let parsed: { domain?: string; keyword?: string; urgent?: boolean }
    try { parsed = JSON.parse(raw) } catch { return jsonRes(fallback) }

    const domain  = DOMAINS.includes(parsed.domain ?? '') ? parsed.domain! : 'service'
    const keyword = (parsed.keyword ?? '').trim() || text
    return jsonRes({ domain, keyword, urgent: !!parsed.urgent })
  } catch (err) {
    console.error('smart-search error', err)
    // 出错也回退,不让搜索失败
    return jsonRes({ domain: 'service', keyword: '', urgent: false })
  }
})
