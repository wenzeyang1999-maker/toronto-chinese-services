import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Action = 'expand_search' | 'draft_service'

const CATEGORY_LABELS: Record<string, string> = {
  moving: '搬家',
  cleaning: '保洁',
  ride: '接送',
  renovation: '装修',
  cashwork: '现金工',
  food: '餐饮',
  other: '其他',
}

function fallbackExpandedTerms(query: string): string[] {
  const lower = query.toLowerCase()
  const pairs: Array<[RegExp, string[]]> = [
    [/(漏水|水管|堵塞|下水|马桶|龙头)/, ['水管维修', '管道疏通', 'plumbing']],
    [/(搬家|搬运|货车|搬东西)/, ['本地搬家', '长途搬运', '搬运工']],
    [/(保洁|清洁|打扫|地毯|玻璃)/, ['日常保洁', '深度清洁', '地毯清洗']],
    [/(机场|接送|司机|包车)/, ['机场接送', '包车服务', '跨城接送']],
    [/(报税|税务|会计|cpa)/, ['报税会计', '税务咨询']],
    [/(钢琴|音乐|家教|补习|教练)/, ['钢琴教学', '中文家教', '数学家教']],
  ]

  const terms = new Set<string>()
  for (const [pattern, expanded] of pairs) {
    if (pattern.test(lower)) expanded.forEach((term) => terms.add(term))
  }
  return Array.from(terms)
}

async function fetchServiceTitles() {
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anonKey) return [] as string[]

  const client = createClient(url, anonKey)
  const { data } = await client
    .from('services')
    .select('title')
    .eq('is_available', true)
    .order('created_at', { ascending: false })
    .limit(80)

  return (data ?? []).map((row: { title: string }) => row.title)
}

async function askModel(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY')
  if (!apiKey) throw new Error('GROQ_API_KEY secret not configured')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '你是结构化输出助手。只输出合法 JSON，不要输出 markdown，不要解释。',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`Groq error ${res.status}: ${await res.text()}`)
  }

  const json = await res.json()
  return json.choices?.[0]?.message?.content ?? '{}'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { action, payload } = await req.json() as { action: Action; payload: Record<string, unknown> }

    if (action === 'expand_search') {
      const query = String(payload.query ?? '').trim()
      if (!query) {
        return new Response(JSON.stringify({ terms: [] }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }

      const serviceTitles = await fetchServiceTitles()
      let aiTerms: string[] = []
      try {
        const raw = await askModel(
          `用户搜索词：${query}
平台当前服务标题样例：${serviceTitles.slice(0, 40).join(' / ')}

请输出 JSON：
{
  "terms": ["最多6个适合搜索扩展的中文短语"]
}

要求：
1. 只输出与本地生活服务匹配的短语
2. 不要重复用户原词
3. 优先输出用户真实会点进去的服务名，如“水管维修”“屋顶维修”
4. 最多 6 个`
        )
        const parsed = JSON.parse(raw)
        aiTerms = Array.isArray(parsed.terms) ? parsed.terms.map((term) => String(term).trim()).filter(Boolean) : []
      } catch {
        aiTerms = []
      }

      const merged = Array.from(new Set([...fallbackExpandedTerms(query), ...aiTerms])).slice(0, 6)
      return new Response(JSON.stringify({ terms: merged }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'draft_service') {
      const categoryId = String(payload.categoryId ?? 'other')
      const categoryLabel = CATEGORY_LABELS[categoryId] ?? '其他服务'
      const keywords = String(payload.keywords ?? '').trim()
      const title = String(payload.title ?? '').trim()
      const serviceAreas = Array.isArray(payload.serviceAreas) ? payload.serviceAreas.map((item) => String(item)) : []
      const priceType = String(payload.priceType ?? 'hourly')
      const imageCount = Number(payload.imageCount ?? 0)

      const raw = await askModel(
        `你要帮多伦多华人服务平台的服务商生成发布文案。
服务分类：${categoryLabel}
当前标题：${title || '未填写'}
关键词/补充说明：${keywords || '未填写'}
服务区域：${serviceAreas.join('、') || '多伦多'}
价格类型：${priceType}
图片数量：${imageCount}

请输出 JSON：
{
  "title": "20字内标题",
  "description": "120到220字，口语自然，强调服务内容、经验、适合人群、响应速度，不要夸张承诺",
  "tags": ["最多6个短标签"]
}

要求：
1. 必须贴近本地华人服务语境
2. 标题不要太营销，不要出现联系电话
3. 描述要能直接用于发布页
4. tags 用于搜索联想，尽量具体`
      )

      return new Response(raw, {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'unknown action' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'unknown error' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
