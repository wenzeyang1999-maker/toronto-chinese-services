// transcribe-audio: 接收前端录制的音频，转发给 Groq Whisper 做语音转写。
// 用于替代浏览器 Web Speech API —— 后者在 Safari/iOS 上极不可靠（给了麦克风权限
// 也常常一个结果都不回）。录音→上传→Whisper 转写，在所有浏览器都稳定工作。
import { allowAiCall } from '../_shared/aiRateLimit.ts'

const RL_MAX     = 40                 // 每 IP 每窗口最多次数
const RL_WINDOW  = 10 * 60 * 1000     // 10 分钟
const MAX_BYTES  = 12 * 1024 * 1024   // 12MB 上限（约数分钟录音）

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

function json(status: number, obj: unknown, cors: Record<string, string>) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// 领域提示词：把 Whisper 往"本地生活服务需求"的语境上引（降低幻觉落款概率），
// 并明确要求保留英文街道/地名——客人常在普通话里夹英文(North York、Finch 等)，
// 锁死中文会把这些音译成汉字。给出大多伦多常见地名示例作为参照。
const WHISPER_PROMPT =
  '这是一段以普通话为主、可能夹杂英文街道和地名的语音，用户在描述本地生活服务需求' +
  '（搬家、保洁、厨师、接送、维修、装修等）。英文地名与街道请保留英文，例如：' +
  'North York、Scarborough、Markham、Richmond Hill、Mississauga、Finch、Yonge Street、Highway 7。'

// Whisper 在音频偏短/偏轻/含噪时的典型幻觉落款。命中即视为没听清，返回空文本让前端提示重说。
const HALLUCINATION_MARKERS = [
  '字幕志愿者', '字幕君', '字幕组', '中文字幕',
  '谢谢观看', '感谢观看', '谢谢大家观看', '谢谢收看',
  '请不吝点赞', '点赞订阅', '订阅转发', '打赏支持',
  'Amara.org', '点点栏目', '明镜与点点',
  'MING PAO', 'MINGPAO', '明報', '明报', 'MING PAO CANADA', 'MING PAO TORONTO',
]
function isLikelyHallucination(text: string): boolean {
  return HALLUCINATION_MARKERS.some((m) => text.includes(m))
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const cors   = corsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405, headers: cors })

  if (!(await allowAiCall(req, 'transcribe-audio', RL_MAX, RL_WINDOW))) {
    return json(429, { error: '请求过于频繁，请稍后再试' }, cors)
  }

  try {
    const inForm = await req.formData()
    const file   = inForm.get('file')
    if (!(file instanceof File)) return json(400, { error: '缺少音频文件' }, cors)
    if (file.size === 0)         return json(400, { error: '录音为空，请再说一次' }, cors)
    if (file.size > MAX_BYTES)   return json(400, { error: '录音过长，请分段录入' }, cors)

    // 语言：默认自动识别（同时支持普通话 / 英语 / 中英混说）。只有前端明确传 zh/en
    // 时才锁定语言；传 'auto' 或不传则交给 Whisper 自动判定，避免锁死中文误伤纯英文。
    const langRaw = String(inForm.get('language') ?? '').trim().toLowerCase()
    console.log('[transcribe] recv audio', { type: file.type, name: file.name, size: file.size, lang: langRaw || 'auto' })

    const apiKey = Deno.env.get('GROQ_API_KEY')
    if (!apiKey) throw new Error('GROQ_API_KEY not configured')

    const groqForm = new FormData()
    groqForm.append('file', file, file.name || 'audio.webm')
    groqForm.append('model', 'whisper-large-v3')  // 中文精度优于 turbo；也支持中英混说
    // 仅在明确指定 zh/en 时锁定；否则(auto/空)让 Whisper 自动识别，覆盖普通话+英语。
    if (langRaw && langRaw !== 'auto') groqForm.append('language', langRaw)
    groqForm.append('prompt', WHISPER_PROMPT)
    groqForm.append('response_format', 'json')
    groqForm.append('temperature', '0')

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body:    groqForm,
      signal:  AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Groq error ${res.status}: ${err}`)
    }

    const data = await res.json()
    let text = String(data.text ?? '').trim()
    console.log('[transcribe] whisper raw =', JSON.stringify(text))
    // Whisper 幻觉落款 → 视为没听清，返回空+empty 标记，前端提示重说而非填入垃圾。
    if (isLikelyHallucination(text)) text = ''
    return json(200, { text, empty: text === '' }, cors)
  } catch (_e) {
    return json(500, { error: '转写失败，请重试或改用手动填写' }, cors)
  }
})
