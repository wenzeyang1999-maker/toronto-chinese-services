// ─── Entry Point ──────────────────────────────────────────────────────────────
// Mounts the React app into #root with BrowserRouter for client-side routing.
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import App from './App'
import './index.css'
import { registerServiceWorker } from './lib/pwa'
import { initSentry } from './lib/sentry'

initSentry()
registerServiceWorker()

// After a new deploy, chunk filenames change and the old lazy-loaded chunks are
// gone. A tab opened before the deploy will fail to fetch them ("Failed to fetch
// dynamically imported module"). Vite fires `vite:preloadError` — reload once to
// pull the fresh index.html + new chunk names (guarded so it can't loop).
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  const key = 'tcs_chunk_reload_ts'
  const last = Number(sessionStorage.getItem(key) || '0')
  if (Date.now() - last > 15_000) {
    sessionStorage.setItem(key, String(Date.now()))
    window.location.reload()
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </HelmetProvider>
  </React.StrictMode>
)
