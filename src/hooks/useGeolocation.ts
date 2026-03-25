// ─── useGeolocation Hook ──────────────────────────────────────────────────────
// Requests the browser's geolocation on mount and stores the result in the
// global store. If the user denies or times out, falls back to Toronto downtown.
// Call this hook once at the top-level page that needs distance sorting (Home).
import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'

export function useGeolocation() {
  const setUserLocation = useAppStore((s) => s.setUserLocation)

  useEffect(() => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
      },
      () => {
        // Fallback: Toronto downtown (43.6532, -79.3832)
        setUserLocation({ lat: 43.6532, lng: -79.3832 })
      },
      { timeout: 5000 }
    )
  }, [setUserLocation])
}
