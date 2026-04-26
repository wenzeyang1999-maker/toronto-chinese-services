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

interface ServiceRow {
  title:       string
  category_id: string
  area:        string | null
  price:       number | null
  price_type:  string | null
  provider:    { is_online: boolean } | null
}

async function fetchServicesSummary(): Promise<string> {
  const url            = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) return ''
  try {
    const res = await fetch(
      `${url}/rest/v1/services?select=title,category_id,area,price,price_type,provider:provider_id(is_online)&is_available=eq.true&order=created_at.desc&limit=80`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
    )
    if (!res.ok) return ''
    const rows: ServiceRow[] = await res.json()
    if (!rows.length) return ''

    // Online providers first, then the rest
    rows.sort((a, b) => {
      const aOnline = a.provider?.is_online ? 1 : 0
      const bOnline = b.provider?.is_online ? 1 : 0
      return bOnline - aOnline
    })

    const label: Record<string, string> = {
      moving: '搬家', cleaning: '保洁', ride: '接送',
      renovation: '装修', cashwork: '现金工', food: '餐饮', other: '其他',
    }
    const grouped: Record<string, string[]> = {}
    for (const r of rows) {
      const cat = r.category_id ?? 'other'
      if (!grouped[cat]) grouped[cat] = []
      const priceStr = r.price
        ? `(${r.price}/${r.price_type === 'hourly' ? '小时' : r.price_type === 'fixed' ? '固定' : '面议'})`
        : ''
      const areaStr  = r.area ? ` · ${r.area}` : ''
      const onlineMark = r.provider?.is_online ? ' ⚡在线接单' : ''
      grouped[cat].push(`  - ${r.title}${priceStr}${areaStr}${onlineMark}`)
    }

    const lines = ['当前平台在架服务（实时数据，⚡在线接单 = 服务商当前在线可立即响应）：']
    for (const [cat, items] of Object.entries(grouped)) {
      lines.push(`【${label[cat] ?? cat}】`)
      lines.push(...items.slice(0, 10))
    }
    return lines.join('\n')
  } catch {
    return ''
  }
}

const BASE_PROMPT = `你是 TCS 智能助手，多伦多华人一站式生活服务平台（Toronto Chinese Services）的 AI 客服。

你的职责：
1. 根据用户描述，从平台在架服务中找到最匹配的选项并推荐
2. 告知用户可使用"获取报价"功能，让多家服务商主动联系并报价
3. 指引有技能的用户通过"发布服务"入驻平台接单
4. 解答平台使用相关问题

行为准则：
- 用用户使用的语言回复（中文回中文，英文回英文）
- 优先推荐标注「⚡在线接单」的服务商，他们当前在线、响应更快
- 优先推荐平台现有服务，回答简洁（3-5句话）
- 不要编造不存在的服务商信息或电话
- 如用户需要具体报价，引导使用"获取报价"功能
- 语气专业但亲切，像一位熟悉多伦多华人生活的朋友`

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const cors   = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const { messages } = await req.json() as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    const apiKey = Deno.env.get('GROQ_API_KEY')
    if (!apiKey) throw new Error('GROQ_API_KEY secret not configured')

    const servicesList = await fetchServicesSummary()
    const systemPrompt = servicesList ? `${BASE_PROMPT}\n\n${servicesList}` : BASE_PROMPT

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:      'llama-3.3-70b-versatile',
        max_tokens: 1024,
        stream:     true,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      }),
    })

    if (!groqRes.ok || !groqRes.body) {
      const errText = await groqRes.text()
      throw new Error(`Groq error ${groqRes.status}: ${errText}`)
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const reader = groqRes.body!.getReader()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const payload = line.slice(6).trim()
              if (!payload || payload === '[DONE]') continue
              try {
                const data = JSON.parse(payload)
                const text = data.choices?.[0]?.delta?.content
                if (text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
                }
              } catch { /* skip */ }
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(readable, {
      headers: {
        ...cors,
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: msg }), {
      status:  500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
