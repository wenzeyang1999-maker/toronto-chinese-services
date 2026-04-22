import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '../../lib/googleMaps'

export interface GoogleMapPoint {
  id: string
  lat: number
  lng: number
  title: string
  promoted?: boolean
  infoContent?: string | HTMLElement
  onInfoReady?: (content: HTMLElement) => void
}

interface Props {
  points: GoogleMapPoint[]
  center: { lat: number; lng: number }
  zoom: number
  userLocation?: { lat: number; lng: number } | null
  scrollWheel?: boolean
}

export default function GoogleMapCanvas({
  points,
  center,
  zoom,
  userLocation = null,
  scrollWheel = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const overlaysRef = useRef<any[]>([])
  const infoWindowRef = useRef<any>(null)
  const [error, setError] = useState('')

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
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load Google Maps')
      })

    return () => { active = false }
  }, [])

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

      if (userLocation) {
        const userMarker = new maps.Marker({
          map: mapRef.current,
          position: userLocation,
          title: '我的位置',
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
          zIndex: 1000,
        })
        const accuracyCircle = new maps.Circle({
          map: mapRef.current,
          center: userLocation,
          radius: 300,
          fillColor: '#4285F4',
          fillOpacity: 0.08,
          strokeColor: '#4285F4',
          strokeOpacity: 0.45,
          strokeWeight: 1,
        })
        markersRef.current.push(userMarker)
        overlaysRef.current.push(accuracyCircle)
        bounds.extend(userLocation)
      }

      for (const point of points) {
        const position = { lat: point.lat, lng: point.lng }
        const marker = new maps.Marker({
          map: mapRef.current,
          position,
          title: point.title,
          icon: {
            url: point.promoted
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

      if (hasBounds && points.length + (userLocation ? 1 : 0) > 1) {
        mapRef.current.fitBounds(bounds, 56)
      }
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : 'Failed to load Google Maps')
    })

    return () => { active = false }
  }, [points, userLocation?.lat, userLocation?.lng])

  return (
    <>
      <div ref={containerRef} className="h-full w-full" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-center text-sm text-gray-500 px-4">
          {error}
        </div>
      )}
    </>
  )
}
