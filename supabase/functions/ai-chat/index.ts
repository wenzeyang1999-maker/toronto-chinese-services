import { allowAiCall } from '../_shared/aiRateLimit.ts'

// Anti-abuse: cap input size and rate-limit anonymous callers per IP.
const RL_MAX      = 40                // calls per IP per window
const RL_WINDOW   = 10 * 60 * 1000    // 10 minutes
const MAX_MSGS    = 12                // keep only the last N turns
const MAX_MSG_LEN = 2000              // chars per message

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
      { signal: AbortSignal.timeout(5_000), headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
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
      moving: '搬家', cleaning: '保洁', ride: '接送', renovation: '装修',
      cashwork: '现金工', food: '餐饮', tax: '报税', legal: '法律',
      immigration: '移民', tutoring: '补课/教学', beauty: '美容美发',
      tcm: '中医推拿', pet: '宠物', photo: '摄影', translation: '翻译',
      it: 'IT维修', driving: '驾校', lawn: '园艺除雪', childcare: '育儿保姆',
      insurance: '保险', other: '其他服务',
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

const BASE_PROMPT = `你是「华邻」智能助手 —— 海外华人生活一站式服务平台的 AI 客服。
你既能推荐服务，也要能手把手教用户正确使用本网站。

你的职责：
1. 根据用户描述，从平台在架服务中找到最匹配的选项并推荐
2. 指导用户正确使用平台各项功能（见下方「平台功能与使用指南」）
3. 引导有技能的用户入驻接单
4. 解答平台使用相关问题

── 平台功能与使用指南（据此准确引导用户）──
【找服务】首页可直接搜索关键词，或按分类浏览；服务详情页有评价、地图、真实联系方式（电话/微信/站内消息），可「立即联系」直接联系商家。
【让商家来找你 · 两种方式，要说清区别】
  • 「AI 帮你找」（首页那个✨按钮 / 获取报价）：用一句话描述需求，AI 自动识别，系统会\
把需求直接派发给附近最多 5 位匹配商家，商家会主动联系你 —— 想快、想让商家主动找你就用这个。
  • 「发布服务需求」：只把需求公开挂在地图上，由商家自行浏览后联系，不会自动派发。\
适合不着急、只想公开挂一条的用户。
【我的报价请求】在「我的账号 → 我的报价请求」查看你发过的需求、哪些商家接了单、并可关闭需求。
【商家侧】商家在「我的账号 → 我接的单」查看派发来的客户需求和联系方式，主动联系客户；\
也可在首页「发现客户」地图上浏览附近公开需求。
【发布服务 / 入驻】有技能想接单的用户，用「发布服务」创建自己的服务，出现在平台供客户搜索。
【消息】站内聊天在「我的账号 → 我的消息」，与商家的对话都在这里。
【会员】商家会员（黄金/至尊）有更靠前的展示与免费推广权益，见「我的账号 → 会员等级」。
【其他板块】平台还有招聘求职、二手交易、房产租售、同城活动、社区论坛。

行为准则：
- 用用户使用的语言回复（中文回中文，英文回英文）
- 用户问"怎么用/在哪/如何发需求"等，按上面的指南给出具体、可操作的步骤
- 优先推荐标注「⚡在线接单」的服务商，他们当前在线、响应更快
- 回答简洁（3-6 句话），不要编造不存在的服务商信息或电话
- 需要具体报价时，引导使用「AI 帮你找」（会自动匹配派发）
- 语气专业但亲切，像一位熟悉多伦多华人生活的朋友`

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const cors   = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  if (!(await allowAiCall(req, 'ai-chat', RL_MAX, RL_WINDOW))) {
    return new Response(JSON.stringify({ error: '请求过于频繁，请稍后再试' }), {
      status: 429, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const raw = await req.json() as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
    }
    // Cap input: keep the last few turns, clamp each message length.
    const messages = (Array.isArray(raw.messages) ? raw.messages : [])
      .slice(-MAX_MSGS)
      .map(m => ({ role: m.role, content: String(m.content ?? '').slice(0, MAX_MSG_LEN) }))

    const apiKey = Deno.env.get('GROQ_API_KEY')
    if (!apiKey) throw new Error('GROQ_API_KEY secret not configured')

    const servicesList = await fetchServicesSummary()
    const systemPrompt = servicesList ? `${BASE_PROMPT}\n\n${servicesList}` : BASE_PROMPT

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      signal:  AbortSignal.timeout(20_000),
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
