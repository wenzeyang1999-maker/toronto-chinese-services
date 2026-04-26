// ─── Web Push subscription helper ─────────────────────────────────────────────
// Subscribes the current device to push notifications and persists the
// endpoint to the database so the edge function can deliver pushes.
import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export async function subscribeToWebPush(userId: string): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[webPush] VITE_VAPID_PUBLIC_KEY not configured')
    return false
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  if (Notification.permission !== 'granted') return false

  try {
    // getRegistration resolves immediately with undefined in dev (SW skipped).
    // Calling .ready without a registration hangs forever.
    const existing = await navigator.serviceWorker.getRegistration('/')
    if (!existing) return false
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()

    if (!sub) {
      const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key.buffer as ArrayBuffer,
      })
    }

    const json = sub.toJSON()
    const p256dh = json.keys?.p256dh
    const auth   = json.keys?.auth
    if (!json.endpoint || !p256dh || !auth) return false

    // A push endpoint is browser/device-scoped, so cross-user duplicates would
    // leak notifications. The DB trigger `push_subs_endpoint_dedupe` enforces
    // single-owner-per-endpoint atomically with this upsert.
    await supabase.from('push_subscriptions').upsert(
      {
        user_id:    userId,
        endpoint:   json.endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' }
    )
    return true
  } catch (err) {
    console.warn('[webPush] subscribe failed:', err)
    return false
  }
}

export async function unsubscribeFromWebPush(userId: string): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    const existing = await navigator.serviceWorker.getRegistration('/')
    if (!existing) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    await sub.unsubscribe()
    await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', sub.endpoint)
  } catch (err) {
    console.warn('[webPush] unsubscribe failed:', err)
  }
}
