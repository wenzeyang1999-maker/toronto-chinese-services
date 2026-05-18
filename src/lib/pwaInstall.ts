// ─── Global PWA install state ─────────────────────────────────────────────────
// Captures the browser's `beforeinstallprompt` event once, then lets any
// component trigger the install dialog later (e.g. from a button in Profile).
import { useEffect, useState } from 'react'

interface BIPEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BIPEvent | null = null
let installed = false
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BIPEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    listeners.forEach((l) => l())
  })
}

export function getInstallState() {
  return { canInstall: !!deferred, installed }
}

export async function triggerInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable'
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  listeners.forEach((l) => l())
  return outcome
}

export function useInstallState() {
  const [state, setState] = useState(getInstallState())
  useEffect(() => {
    const cb = () => setState(getInstallState())
    listeners.add(cb)
    return () => { listeners.delete(cb) }
  }, [])
  return state
}
