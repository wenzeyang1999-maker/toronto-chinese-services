import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

// ─── send-otp Edge Function ───────────────────────────────────────────────────
// Generates a 6-digit OTP, persists it, and sends it via Telnyx SMS.
//
// POST body: { phone: string }  — E.164 or bare 10-digit North American number
// Rate limits (enforced in DB):
//   • max 3 OTP requests per user per 10 minutes
//   • max 3 wrong attempts before the code is invalidated (enforced in verify-otp)

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const OTP_TTL_MINUTES  = 5
const RATE_LIMIT_MAX   = 3
const RATE_LIMIT_WINDOW = 10 * 60 * 1000  // 10 minutes in ms

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}

function randomOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const telnyxApiKey    = Deno.env.get('TELNYX_API_KEY')!
  const telnyxFrom      = Deno.env.get('TELNYX_PHONE_NUMBER')!

  // Authenticate caller
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json().catch(() => ({}))
  const phone = toE164((body.phone ?? '').trim())
  if (phone.length < 8) {
    return new Response(JSON.stringify({ error: '手机号格式不正确' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  // Rate limit: count OTPs sent to this user in the last 10 minutes
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW).toISOString()
  const { count } = await admin
    .from('phone_otps')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', windowStart)

  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return new Response(JSON.stringify({ error: '发送太频繁，请 10 分钟后再试' }), {
      status: 429, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Delete any existing OTPs for this user (clean slate)
  await admin.from('phone_otps').delete().eq('user_id', user.id)

  // Insert new OTP
  const code      = randomOtp()
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()
  const { error: insertErr } = await admin.from('phone_otps').insert({
    user_id:    user.id,
    phone,
    code,
    expires_at: expiresAt,
  })
  if (insertErr) {
    console.error('phone_otps insert error:', insertErr)
    return new Response(JSON.stringify({ error: '服务器错误，请稍后重试' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Send SMS via Telnyx V2
  const smsRes = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${telnyxApiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from: telnyxFrom,
      to:   phone,
      text: `您的北美华人圈验证码是 ${code}，${OTP_TTL_MINUTES} 分钟内有效，请勿告知他人。`,
    }),
  })

  if (!smsRes.ok) {
    const detail = await smsRes.text()
    console.error('Telnyx error:', detail)
    // Delete the OTP we just inserted so the user can retry immediately
    await admin.from('phone_otps').delete().eq('user_id', user.id)
    return new Response(JSON.stringify({ error: '短信发送失败，请稍后重试' }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
