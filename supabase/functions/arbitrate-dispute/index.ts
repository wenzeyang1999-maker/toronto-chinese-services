// arbitrate-dispute: generates an AI「初步参考意见」for a dispute.
// Reads (service role) the order, both parties' chat, and completion-photo count,
// asks Groq for a concise advisory opinion, and stores it on the dispute.
// The opinion is ADVISORY ONLY — an admin makes the final call (ToS: platform
// does not arbitrate/guarantee). Photos themselves are shown to the admin in the
// backend; this text model does not analyse image content.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { allowAiCallByUser } from '../_shared/aiRateLimit.ts'

const RL_MAX    = 10
const RL_WINDOW = 10 * 60 * 1000

const ALLOWED_ORIGINS = new Set([
  'https://toronto-chinese-services.vercel.app',
  'https://huarenq.com',
  'https://www.huarenq.com',
  'http://localhost:5173',
  'http://localhost:4173',
])
function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://huarenq.com'
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

const SYSTEM_PROMPT = `你是华邻平台的纠纷调解助手。基于订单信息、双方聊天记录和完工存证情况，给出一份简洁的「初步参考意见」，供平台人工客服参考。要求：
1. 用中文，250 字以内。
2. 客观复述争议焦点，指出聊天记录中的关键事实与双方承诺。
3. 给出倾向性初步判断（更可能哪一方有理）及建议处理方式；但必须明确说明这仅为 AI 初步参考、最终由平台人工裁定。
4. 不得臆造聊天记录里没有的信息。若存在完工存证照片，请提醒人工查看照片进一步核实。`

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const cors   = corsHeaders(origin)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const url        = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!
    const admin      = createClient(url, serviceKey)

    // Auth — caller must be logged in and a party of the dispute (or admin).
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'unauthorized' }, 401)

    if (!(await allowAiCallByUser(user.id, 'arbitrate-dispute', RL_MAX, RL_WINDOW))) {
      return json({ error: '请求过于频繁，请稍后再试' }, 429)
    }

    const { disputeId } = await req.json() as { disputeId?: string }
    if (!disputeId) return json({ error: 'missing disputeId' }, 400)

    const { data: dispute } = await admin.from('disputes').select('*').eq('id', disputeId).maybeSingle()
    if (!dispute) return json({ error: 'dispute not found' }, 404)

    if (dispute.raised_by !== user.id && dispute.against_id !== user.id) {
      const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
      if (me?.role !== 'admin') return json({ error: 'forbidden' }, 403)
    }

    const { data: order } = await admin.from('orders').select('*').eq('id', dispute.order_id).maybeSingle()
    if (!order) return json({ error: 'order not found' }, 404)

    // Both parties' chat (find the conversation between them).
    let chatLines: string[] = []
    const { data: conv } = await admin.from('conversations').select('id')
      .eq('client_id', order.client_id).eq('provider_id', order.provider_id)
      .order('created_at').limit(1).maybeSingle()
    if (conv) {
      const { data: msgs } = await admin.from('messages')
        .select('sender_id, content').eq('conversation_id', conv.id)
        .order('created_at').limit(100)
      chatLines = (msgs ?? []).map((m: { sender_id: string; content: string }) =>
        `${m.sender_id === order.client_id ? '客户' : '服务商'}：${m.content}`)
    }

    const raiserRole = dispute.raised_by === order.client_id ? '客户' : '服务商'
    const photoCount = (order.completion_photos ?? []).length

    const prompt = `【订单信息】
服务：${order.title ?? '（无标题）'}　类目：${order.category_id ?? '未知'}　金额：${order.amount ?? '未填'}
状态：${order.status}　完工存证照片：${photoCount} 张${photoCount ? '（已上传，人工可在后台查看）' : '（未上传）'}
【发起纠纷方】${raiserRole}
【纠纷原因】${dispute.reason}

【双方聊天记录】
${chatLines.length ? chatLines.join('\n') : '（无聊天记录）'}`

    const apiKey = Deno.env.get('GROQ_API_KEY')
    if (!apiKey) throw new Error('GROQ_API_KEY not configured')

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens:  500,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: prompt.slice(0, 8000) },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`)
    const data = await res.json()
    const opinion = data.choices?.[0]?.message?.content?.trim() || '（AI 未能生成意见，请人工处理）'

    await admin.rpc('set_dispute_ai_opinion', { p_dispute_id: disputeId, p_opinion: opinion })

    return json({ ok: true, opinion })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
