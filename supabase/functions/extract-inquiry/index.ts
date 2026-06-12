// extract-inquiry: uses Groq LLM to parse a free-text service request
// into structured fields (category, timing, locations, notes, items).

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
    : 'https://huarenq.com'
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

const CATEGORY_IDS = [
  'moving', 'cleaning', 'ride', 'renovation', 'handyman', 'cashwork',
  'food', 'tax', 'legal', 'immigration', 'tutoring',
  'beauty', 'tcm', 'pet', 'photo', 'translation',
  'it', 'driving', 'lawn', 'childcare', 'insurance', 'junk', 'other',
]

const SYSTEM_PROMPT = `你是一个中文服务请求解析助手。从用户的自然语言描述中提取结构化信息，返回 JSON。

返回格式（严格 JSON，不带 markdown 代码块）：
{
  "category": "<category_id>",
  "timing": "<asap|flexible|next_week>",
  "location_from": "<起始地点或 null>",
  "location_to": "<目的地或 null>",
  "special_notes": "<特殊情况如楼层/无电梯/宠物等，或 null>",
  "items": "<物品清单或 null>",
  "description": "<对原始需求的简洁中文摘要，一句话>"
}

category 必须是以下之一：${CATEGORY_IDS.join(', ')}
timing 规则：提到"今天/明天/尽快/急/ASAP" → asap；提到"下周" → next_week；其他 → flexible

只返回 JSON，不要任何解释文字。`

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const cors   = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors })
  }

  try {
    const { text } = await req.json() as { text: string }
    if (!text?.trim()) {
      return new Response(JSON.stringify({ error: '请输入需求描述' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('GROQ_API_KEY')
    if (!apiKey) throw new Error('GROQ_API_KEY not configured')

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens:  300,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: text.trim() },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Groq error ${res.status}: ${err}`)
    }

    const data = await res.json()
    const raw  = data.choices?.[0]?.message?.content ?? ''

    // Parse the JSON response from the LLM
    let extracted: Record<string, string | null>
    try {
      extracted = JSON.parse(raw)
    } catch {
      // Fallback: return minimal structure if JSON parse fails
      extracted = { category: 'other', timing: 'flexible', description: text.trim(),
                    location_from: null, location_to: null, special_notes: null, items: null }
    }

    return new Response(JSON.stringify(extracted), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
