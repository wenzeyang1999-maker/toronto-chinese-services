// ─── useGeolocation Hook ──────────────────────────────────────────────────────
// Exposes an imperative location request so pages can ask only after a
// meaningful user action (search, map view, distance sort).
import { useAppStore } from '../store/appStore'

export function useGeolocation() {
  const setUserLocation = useAppStore((s) => s.setUserLocation)

  return () => {
    if (!navigator.geolocation) {
      setUserLocation(null)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
      },
      () => {
        setUserLocation(null)
      },
      { timeout: 5000 }
    )
  }
}
