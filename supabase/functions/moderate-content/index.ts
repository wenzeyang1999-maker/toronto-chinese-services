// ── Content Moderation Edge Function ─────────────────────────────────────────
// POST { text: string }
// Returns { pass: boolean, reason?: string }
// Uses Groq llama-3 for fast, cheap classification.

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
1. 政治内容：涉及中国大陆/台湾/香港政治、领导人批评、政党宣传、抗议活动
2. 违法内容：毒品、武器、色情、赌博、诈骗、非法移民中介
3. 仇恨言论：种族歧视、人身攻击、骚扰
4. 敏感话题：新疆、西藏、法轮功等政治敏感议题
5. 虚假医疗：声称能治愈疾病的偏方、无牌医疗服务

如果内容是正常的生活服务广告、社区帖子、需求发布，直接通过。
对于模糊的内容，宁可通过（false positive 代价低）。

只返回 JSON，格式严格如下，不要有任何其他文字：
{"pass":true} 或 {"pass":false,"reason":"具体原因（中文，15字以内）"}`

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const cors   = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const { text } = await req.json() as { text: string }
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
    // Always fail open so a function error doesn't block all publishing
    console.error('moderate-content error:', err)
    return new Response(JSON.stringify({ pass: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
