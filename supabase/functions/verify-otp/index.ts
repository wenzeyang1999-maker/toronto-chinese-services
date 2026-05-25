import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

// ─── verify-otp Edge Function ─────────────────────────────────────────────────
// Validates a 6-digit OTP code and, on success, marks the user's phone as
// verified in public.users.
//
// POST body: { phone: string, code: string }

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_ATTEMPTS = 3

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')!

  // Authenticate caller
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const body  = await req.json().catch(() => ({}))
  const phone = toE164((body.phone ?? '').trim())
  const code  = (body.code ?? '').trim()

  if (!code || code.length !== 6) {
    return new Response(JSON.stringify({ error: '请输入 6 位验证码' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  // Fetch the most recent OTP for this user
  const { data: otp, error: fetchErr } = await admin
    .from('phone_otps')
    .select('id, phone, code, attempts, expires_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (fetchErr || !otp) {
    return new Response(JSON.stringify({ error: '验证码不存在，请重新发送' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Check expiry
  if (new Date(otp.expires_at) < new Date()) {
    await admin.from('phone_otps').delete().eq('id', otp.id)
    return new Response(JSON.stringify({ error: '验证码已过期，请重新发送' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Check phone matches what was sent to
  if (otp.phone !== phone) {
    return new Response(JSON.stringify({ error: '手机号与发送时不一致' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Wrong code — increment attempts and fail
  if (otp.code !== code) {
    const newAttempts = (otp.attempts ?? 0) + 1
    if (newAttempts >= MAX_ATTEMPTS) {
      await admin.from('phone_otps').delete().eq('id', otp.id)
      return new Response(JSON.stringify({ error: '验证码错误次数过多，请重新发送' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    await admin.from('phone_otps').update({ attempts: newAttempts }).eq('id', otp.id)
    return new Response(JSON.stringify({ error: `验证码错误，还剩 ${MAX_ATTEMPTS - newAttempts} 次机会` }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Correct code — mark phone as verified and clean up
  const { error: updateErr } = await admin
    .from('users')
    .update({ phone, phone_verified: true })
    .eq('id', user.id)

  if (updateErr) {
    console.error('users update error:', updateErr)
    return new Response(JSON.stringify({ error: '验证成功但保存失败，请稍后重试' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  await admin.from('phone_otps').delete().eq('id', otp.id)

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
