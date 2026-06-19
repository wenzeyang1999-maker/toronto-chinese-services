// ─── Sentry error monitoring ─────────────────────────────────────────────────
// Initialised only when VITE_SENTRY_DSN is provided, so local dev and any
// environment without the DSN configured stay a no-op. Set the DSN in the
// deployment env (e.g. Vercel) to start capturing production errors.
import * as Sentry from '@sentry/react'

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Capture a fraction of transactions for performance monitoring.
    tracesSampleRate: 0.1,
    // Only send errors in production builds to avoid noise from dev.
    enabled: import.meta.env.PROD,
  })
}

export { Sentry }
