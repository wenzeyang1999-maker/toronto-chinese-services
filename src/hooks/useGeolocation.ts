// ─── useGeolocation Hook ──────────────────────────────────────────────────────
// Exposes an imperative location request so pages can ask only after a
// meaningful user action (search, map view, distance sort, "update my location").
//
// Pass { maxAgeMs } to make it a staleness-gated refresh: if the cached fix is
// still fresh enough it's a no-op ('throttled'); if it's older than maxAgeMs (or
// missing) a fresh fix is fetched. This keeps the map from showing "home" after
// the user has gone out, and lets the manual "更新我的位置" button rate-limit real
// GPS reads. Returns a Promise so callers can give feedback (toast / spinner).
import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { toast } from '../lib/toast'

/** A cached location older than this (ms) is treated as stale → re-fetch. */
export const LOCATION_STALE_MS = 10 * 60 * 1000 // 10 minutes (auto refresh)
/** Manual "更新我的位置" button: really hit GPS at most once per this window. */
export const LOCATION_MANUAL_THROTTLE_MS = 5 * 60 * 1000 // 5 minutes

export type GeoResult =
  | 'updated'      // a fresh fix was obtained
  | 'throttled'    // skipped — the cached fix is still fresh enough
  | 'failed'       // permission denied / timeout / error
  | 'unsupported'  // no geolocation API

export function useGeolocation() {
  const setUserLocation = useAppStore((s) => s.setUserLocation)

  return (opts?: { maxAgeMs?: number }): Promise<GeoResult> => {
    // Staleness gate: skip the geo call when we already have a recent enough fix.
    if (opts?.maxAgeMs != null) {
      const { userLocation, locationCapturedAt } = useAppStore.getState()
      if (userLocation && locationCapturedAt && Date.now() - locationCapturedAt < opts.maxAgeMs) {
        return Promise.resolve('throttled')
      }
    }

    if (!navigator.geolocation) {
      if (!useAppStore.getState().userLocation) setUserLocation(null)
      return Promise.resolve('unsupported')
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          resolve('updated')
        },
        // On failure keep the last-known fix (don't blank the map on a hiccup);
        // only signal "no location" when we never had one.
        () => {
          if (!useAppStore.getState().userLocation) setUserLocation(null)
          resolve('failed')
        },
        { timeout: 5000 }
      )
    })
  }
}

// ─── useUpdateLocation ────────────────────────────────────────────────────────
// Backs the manual「更新我的位置」button shared by every map (ServiceMap / MapPage
// / PropertyMap). Forces a fresh GPS read so a user who moved (e.g. driving) can
// correct a wrong dot, throttled to a real read at most once / 5 min, with toast
// feedback. Pass an onUpdated callback to re-center the map on the new fix.
export function useUpdateLocation() {
  const requestLocation = useGeolocation()
  const [locating, setLocating] = useState(false)

  async function updateLocation(onUpdated?: () => void) {
    if (locating) return
    setLocating(true)
    const result = await requestLocation({ maxAgeMs: LOCATION_MANUAL_THROTTLE_MS })
    setLocating(false)
    // 'throttled' = a real GPS read was skipped because the cached fix is still
    // fresh (<5 min). We intentionally present it as a normal successful update —
    // the user doesn't need to know about the rate limit; the throttle keeps
    // quietly protecting battery/API from rapid repeated taps.
    if (result === 'updated' || result === 'throttled') {
      onUpdated?.()
      toast('位置已更新', 'success')
    } else if (result === 'failed') {
      toast('定位失败，请检查定位权限后重试', 'error')
    } else {
      toast('当前设备不支持定位', 'error')
    }
  }

  return { locating, updateLocation }
}
