// ─── Supabase Auth "Send SMS Hook" → Telnyx ─────────────────────────────────
// Supabase native phone auth (signInWithOtp/verifyOtp) mints the account + session,
// but Telnyx isn't a built-in Supabase SMS provider — so we route the OTP delivery
// through this hook, which sends it via our existing Telnyx number. Reuses the same
// TELNYX_API_KEY / TELNYX_PHONE_NUMBER as send-otp.
//
// Configure in Supabase: Authentication → Hooks → "Send SMS hook" → HTTP → point at
//   https://<project>.functions.supabase.co/auth-sms-hook
// and set the generated secret as this function's SEND_SMS_HOOK_SECRET env var.

const TELNYX_API_KEY = Deno.env.get('TELNYX_API_KEY') ?? ''
const TELNYX_FROM    = Deno.env.get('TELNYX_PHONE_NUMBER') ?? ''
const HOOK_SECRET    = Deno.env.get('SEND_SMS_HOOK_SECRET') ?? ''

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// Standard Webhooks (svix-style) signature check used by Supabase auth hooks.
async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  if (!HOOK_SECRET) return true // not locked down yet — allow so setup isn't deadlocked
  try {
    const id   = req.headers.get('webhook-id') ?? ''
    const ts   = req.headers.get('webhook-timestamp') ?? ''
    const sigH = req.headers.get('webhook-signature') ?? ''
    const secret = HOOK_SECRET.replace(/^v1,/, '').replace(/^whsec_/, '')
    const key = await crypto.subtle.importKey(
      'raw', b64ToBytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    )
    const signed = new TextEncoder().encode(`${id}.${ts}.${rawBody}`)
    const mac = await crypto.subtle.sign('HMAC', key, signed)
    const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))
    // header is a space-separated list of "v1,<sig>"
    return sigH.split(' ').some((s) => s.split(',')[1] === expected)
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const rawBody = await req.text()
  if (!(await verifySignature(req, rawBody))) {
    return new Response(JSON.stringify({ error: { message: 'invalid signature' } }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  let phone = ''
  let otp = ''
  try {
    const payload = JSON.parse(rawBody)
    phone = payload?.user?.phone ?? ''
    otp   = payload?.sms?.otp ?? ''
  } catch {
    return new Response(JSON.stringify({ error: { message: 'bad payload' } }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!phone || !otp) {
    return new Response(JSON.stringify({ error: { message: 'missing phone/otp' } }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }
  const to = phone.startsWith('+') ? phone : `+${phone.replace(/\D/g, '')}`

  const smsRes = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: TELNYX_FROM,
      to,
      text: `您的华邻登录验证码是 ${otp}，5 分钟内有效，请勿告知他人。`,
    }),
  })

  if (!smsRes.ok) {
    const detail = await smsRes.text()
    console.error('Telnyx send failed:', smsRes.status, detail)
    // Tell Supabase delivery failed so it surfaces an error to the client.
    return new Response(JSON.stringify({ error: { message: 'sms delivery failed', http_code: 502 } }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  // 200 with empty/OK body = Supabase considers the SMS sent.
  return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
