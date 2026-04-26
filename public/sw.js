// ─── NCC Service Worker ──────────────────────────────────────────────────────
// Minimal PWA shell — handles install/activate lifecycle and forwards push
// notifications to the OS. Caching is intentionally light because the app is
// single-page and Vercel serves bundled assets with content hashes.

const VERSION = 'ncc-sw-v1'

self.addEventListener('install', (event) => {
  // Activate the new SW immediately on next launch
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Take control of any open clients without requiring a reload
  event.waitUntil(self.clients.claim())
})

// ── Web Push ────────────────────────────────────────────────────────────────
// Payload shape sent from our edge function:
//   { title, body, icon?, url?, tag? }
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try { payload = event.data.json() } catch { payload = { title: 'NCC', body: event.data.text() } }

  const title   = payload.title || 'NCC · 北美华人圈'
  const options = {
    body:    payload.body || '',
    icon:    payload.icon || '/favicon.svg',
    badge:   '/favicon.svg',
    tag:     payload.tag,
    data:    { url: payload.url || '/' },
    renotify: true,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // Reuse an existing tab if open
      for (const client of all) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) await client.navigate(url)
          return
        }
      }
      // Otherwise open a new one
      if (self.clients.openWindow) await self.clients.openWindow(url)
    })()
  )
})
