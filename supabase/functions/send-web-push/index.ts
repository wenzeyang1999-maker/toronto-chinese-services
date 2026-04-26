// ─── send-web-push Edge Function ──────────────────────────────────────────────
// Delivers a push notification to all of a user's registered devices.
//
// Auth model:
//   - Caller must include a valid Supabase JWT (Authorization: Bearer ...).
//   - Caller may only push to a user they share a `conversations` row with,
//     and `conversationId` must match. Prevents anonymous spam / phishing.
//
// POST body:
//   { conversationId: string, recipientUserId: string,
//     title: string, body: string,
//     url?: string, tag?: string, icon?: string }
//
// Env vars (Supabase Dashboard → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY    — base64url-encoded P-256 public key
//   VAPID_PRIVATE_KEY   — base64url-encoded P-256 private key
//   VAPID_SUBJECT       — mailto:you@example.com
//   SUPABASE_URL        — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import webpush from 'npm:web-push@3.6.7'

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

interface PushBody {
  conversationId:  string
  recipientUserId: string
  title:           string
  body:            string
  url?:            string
  tag?:            string
  icon?:           string
}

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')  ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')     ?? 'mailto:noreply@huarenq.com'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const CORS   = corsHeaders(origin)

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return json({ error: 'VAPID keys not configured' }, 500)
  }

  // ── Verify caller's JWT ────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return json({ error: 'Missing Authorization' }, 401)

  const { data: userData, error: userErr } = await sb.auth.getUser(jwt)
  if (userErr || !userData?.user) return json({ error: 'Invalid token' }, 401)
  const callerId = userData.user.id

  // ── Parse and validate body ────────────────────────────────────────────────
  let payload: PushBody
  try { payload = await req.json() }
  catch { return json({ error: 'Invalid JSON' }, 400) }

  if (!payload.conversationId || !payload.recipientUserId || !payload.title || !payload.body) {
    return json({ error: 'Missing required fields' }, 400)
  }
  if (payload.recipientUserId === callerId) {
    return json({ error: 'Cannot push to self' }, 400)
  }

  // ── Authorize: caller and recipient must be the two parties of this convo ──
  const { data: convo, error: convoErr } = await sb
    .from('conversations')
    .select('client_id, provider_id')
    .eq('id', payload.conversationId)
    .single()

  if (convoErr || !convo) return json({ error: 'Conversation not found' }, 404)

  const parties = new Set([convo.client_id, convo.provider_id])
  if (!parties.has(callerId) || !parties.has(payload.recipientUserId)) {
    return json({ error: 'Not a participant of this conversation' }, 403)
  }

  // ── Look up recipient's devices and dispatch ───────────────────────────────
  const { data: subs, error } = await sb
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', payload.recipientUserId)

  if (error) return json({ error: error.message }, 500)
  if (!subs || subs.length === 0) return json({ ok: true, sent: 0, skipped: 'no subscriptions' })

  const messageJson = JSON.stringify({
    title: payload.title,
    body:  payload.body,
    url:   payload.url ?? '/',
    tag:   payload.tag,
    icon:  payload.icon,
  })

  const results = await Promise.allSettled(subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        messageJson,
      )
      return { id: sub.id, ok: true }
    } catch (err: any) {
      const code = err?.statusCode ?? 0
      if (code === 404 || code === 410) {
        await sb.from('push_subscriptions').delete().eq('id', sub.id)
      }
      return { id: sub.id, ok: false, code, message: err?.message }
    }
  }))

  type SettledResult = PromiseSettledResult<{ id: string; ok: boolean; code?: number; message?: string }>
  const sent   = results.filter((r: SettledResult) => r.status === 'fulfilled' && r.value.ok).length
  const failed = results.length - sent
  return json({ ok: true, sent, failed, results: results.map((r: SettledResult) => r.status === 'fulfilled' ? r.value : { ok: false, error: String((r as PromiseRejectedResult).reason) }) })
})
