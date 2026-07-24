// transcribe-audio: 接收前端录制的音频，转发给 Groq Whisper 做语音转写。
// 用于替代浏览器 Web Speech API —— 后者在 Safari/iOS 上极不可靠（给了麦克风权限
// 也常常一个结果都不回）。录音→上传→Whisper 转写，在所有浏览器都稳定工作。
import { allowAiCall } from '../_shared/aiRateLimit.ts'

const RL_MAX     = 40                 // 每 IP 每窗口最多次数
const RL_WINDOW  = 10 * 60 * 1000     // 10 分钟
const MAX_BYTES  = 12 * 1024 * 1024   // 12MB 上限（约数分钟录音）

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

function json(status: number, obj: unknown, cors: Record<string, string>) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// 领域提示词：把 Whisper 往"本地生活服务需求"的语境上引，显著降低它在音频不清时
// 瞎编中文视频字幕落款(如「字幕志愿者 XXX」「谢谢观看」)的概率。
const WHISPER_PROMPT =
  '以下是一段普通话语音，用户在描述需要的本地生活服务需求，例如搬家、保洁、厨师、接送、维修、装修等。'

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

    const lang = String(inForm.get('language') ?? 'zh') || 'zh'
    console.log('[transcribe] recv audio', { type: file.type, name: file.name, size: file.size })

    const apiKey = Deno.env.get('GROQ_API_KEY')
    if (!apiKey) throw new Error('GROQ_API_KEY not configured')

    const groqForm = new FormData()
    groqForm.append('file', file, file.name || 'audio.webm')
    groqForm.append('model', 'whisper-large-v3')  // 中文精度优于 turbo，短句更稳
    groqForm.append('language', lang)
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
