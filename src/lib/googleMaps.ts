type GoogleMapsWindow = Window & typeof globalThis & {
  google?: any
  __tcsGoogleMapsInit?: () => void
  __tcsGoogleMapsPromise?: Promise<any>
}

export function getGoogleMapsApiKey(): string {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
}

export function loadGoogleMaps(): Promise<any> {
  const apiKey = getGoogleMapsApiKey()
  if (!apiKey) return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not configured'))

  const win = window as GoogleMapsWindow
  if (win.google?.maps) return Promise.resolve(win.google.maps)
  if (win.__tcsGoogleMapsPromise) return win.__tcsGoogleMapsPromise

  win.__tcsGoogleMapsPromise = new Promise((resolve, reject) => {
    win.__tcsGoogleMapsInit = () => {
      resolve(win.google?.maps)
      delete win.__tcsGoogleMapsInit
    }

    const script = document.createElement('script')
    const params = new URLSearchParams({
      key: apiKey,
      v: 'weekly',
      loading: 'async',
      callback: '__tcsGoogleMapsInit',
    })
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
    script.async = true
    script.defer = true
    script.onerror = () => {
      delete win.__tcsGoogleMapsPromise
      delete win.__tcsGoogleMapsInit
      reject(new Error('Failed to load Google Maps'))
    }
    document.head.appendChild(script)
  })

  return win.__tcsGoogleMapsPromise
}
