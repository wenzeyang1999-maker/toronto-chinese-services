// ─── send-web-push Edge Function ──────────────────────────────────────────────
// Delivers a push notification to all of a user's registered devices.
//
// POST body:
//   { recipientUserId: string, title: string, body: string,
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

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PushBody {
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
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return json({ error: 'VAPID keys not configured' }, 500)
  }

  let payload: PushBody
  try { payload = await req.json() }
  catch { return json({ error: 'Invalid JSON' }, 400) }

  if (!payload.recipientUserId || !payload.title || !payload.body) {
    return json({ error: 'Missing required fields' }, 400)
  }

  // Look up all of the recipient's device subscriptions
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

  const results = await Promise.allSettled(subs.map(async (sub) => {
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
      // 404 / 410 = subscription expired or unsubscribed → clean up
      const code = err?.statusCode ?? 0
      if (code === 404 || code === 410) {
        await sb.from('push_subscriptions').delete().eq('id', sub.id)
      }
      return { id: sub.id, ok: false, code, message: err?.message }
    }
  }))

  const sent    = results.filter(r => r.status === 'fulfilled' && (r.value as any).ok).length
  const failed  = results.length - sent
  return json({ ok: true, sent, failed, results: results.map(r => r.status === 'fulfilled' ? r.value : { ok: false, error: String(r.reason) }) })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
