import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { loadGoogleMaps } from '../../lib/googleMaps'

export interface GoogleMapPoint {
  id: string
  lat: number
  lng: number
  title: string
  promoted?: boolean
  demandPin?: boolean    // orange "求服务" pin
  onlineProv?: boolean   // green "在线接单" pin
  infoContent?: string | HTMLElement
  onInfoReady?: (content: HTMLElement) => void
}

export interface GoogleMapCanvasHandle {
  panToUser: () => void
}

interface Props {
  points: GoogleMapPoint[]
  center: { lat: number; lng: number }
  zoom: number
  userLocation?: { lat: number; lng: number } | null
  scrollWheel?: boolean
  /** Search radius in km — draws a circle around the user and fits the map to it. */
  radiusKm?: number
}

const GoogleMapCanvas = forwardRef<GoogleMapCanvasHandle, Props>(function GoogleMapCanvas({
  points,
  center,
  zoom,
  userLocation = null,
  scrollWheel = true,
  radiusKm,
}, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const overlaysRef = useRef<any[]>([])
  const infoWindowRef = useRef<any>(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useImperativeHandle(ref, () => ({
    panToUser() {
      if (mapRef.current && userLocation) {
        mapRef.current.panTo(userLocation)
        mapRef.current.setZoom(15)
      }
    },
  }), [userLocation])

  useEffect(() => {
    let active = true

    loadGoogleMaps()
      .then((maps) => {
        if (!active || !containerRef.current) return

        if (!mapRef.current) {
          mapRef.current = new maps.Map(containerRef.current, {
            center,
            zoom,
            mapTypeControl: false,
            fullscreenControl: false,
            streetViewControl: false,
            clickableIcons: false,
            scrollwheel: scrollWheel,
          })
          infoWindowRef.current = new maps.InfoWindow()
        }
        setReady(true)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load Google Maps')
      })

    return () => { active = false }
  }, [])

  // Keep the map correctly sized when its container grows — e.g. a collapsible
  // wrapper that animates from height 0. Google Maps measures the container once
  // at init, so a map created inside a 0-height box renders blank and never
  // re-measures; a resize trigger on growth fixes it.
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const g = (window as unknown as { google?: any }).google
      const map = mapRef.current
      if (!map || !g?.maps || el.offsetHeight === 0) return
      g.maps.event.trigger(map, 'resize')
      map.setCenter(center)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ready, center.lat, center.lng])

  useEffect(() => {
    if (!mapRef.current) return

    const map = mapRef.current
    map.setCenter(center)
    map.setZoom(zoom)
    map.setOptions({ scrollwheel: scrollWheel })
  }, [center.lat, center.lng, zoom, scrollWheel])

  useEffect(() => {
    let active = true

    loadGoogleMaps().then((maps) => {
      if (!active || !mapRef.current) return

      markersRef.current.forEach((marker) => marker.setMap(null))
      overlaysRef.current.forEach((overlay) => overlay.setMap(null))
      markersRef.current = []
      overlaysRef.current = []

      const bounds = new maps.LatLngBounds()
      const hasBounds = points.length > 0 || !!userLocation
      let searchCircle: any = null

      if (userLocation) {
        const userMarker = new maps.Marker({
          map: mapRef.current,
          position: userLocation,
          title: '我的位置',
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#EF4444',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
          zIndex: 1000,
        })
        markersRef.current.push(userMarker)
        bounds.extend(userLocation)

        if (radiusKm && radiusKm > 0) {
          // Search-radius circle — grows/shrinks with the slider.
          searchCircle = new maps.Circle({
            map: mapRef.current,
            center: userLocation,
            radius: radiusKm * 1000,
            fillColor: '#2563eb',
            fillOpacity: 0.06,
            strokeColor: '#2563eb',
            strokeOpacity: 0.4,
            strokeWeight: 1.5,
          })
          overlaysRef.current.push(searchCircle)
        } else {
          const accuracyCircle = new maps.Circle({
            map: mapRef.current,
            center: userLocation,
            radius: 300,
            fillColor: '#EF4444',
            fillOpacity: 0.08,
            strokeColor: '#EF4444',
            strokeOpacity: 0.35,
            strokeWeight: 1,
          })
          overlaysRef.current.push(accuracyCircle)
        }
      }

      for (const point of points) {
        const position = { lat: point.lat, lng: point.lng }
        const marker = new maps.Marker({
          map: mapRef.current,
          position,
          title: point.title,
          icon: {
            url: point.demandPin
              ? 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png'
              : point.onlineProv
                ? 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
                : point.promoted
                  ? 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
                  : 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
          },
        })

        marker.addListener('click', () => {
          const content = point.infoContent ?? point.title
          infoWindowRef.current.setContent(content)
          infoWindowRef.current.open({ map: mapRef.current, anchor: marker })
          if (content instanceof HTMLElement) point.onInfoReady?.(content)
        })

        markersRef.current.push(marker)
        bounds.extend(position)
      }

      if (searchCircle) {
        // Fit the map to the search-radius circle so it always fills the frame.
        const circleBounds = searchCircle.getBounds()
        if (circleBounds) mapRef.current.fitBounds(circleBounds, 24)
      } else if (hasBounds && points.length + (userLocation ? 1 : 0) > 1) {
        mapRef.current.fitBounds(bounds, 56)
      }
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : 'Failed to load Google Maps')
    })

    return () => { active = false }
  }, [points, userLocation?.lat, userLocation?.lng, radiusKm])

  return (
    <>
      <div ref={containerRef} className="h-full w-full" />
      {!ready && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-100 animate-pulse text-sm text-gray-400">
          <MapPin size={24} className="opacity-40" />
          地图加载中…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-center text-sm text-gray-500 px-4">
          {error}
        </div>
      )}
    </>
  )
})

export default GoogleMapCanvas
