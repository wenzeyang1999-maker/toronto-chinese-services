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
  // 只有 Map 类确实已加载才走快路径。loading=async 下 google.maps 可能已存在但
  // Map/Marker 等类尚未按需加载(new maps.Map 会报 "new r.Map" undefined)。
  if (win.google?.maps?.Map) return Promise.resolve(win.google.maps)
  if (win.__tcsGoogleMapsPromise) return win.__tcsGoogleMapsPromise

  win.__tcsGoogleMapsPromise = new Promise((resolve, reject) => {
    win.__tcsGoogleMapsInit = async () => {
      // loading=async:回调触发≠所有类就绪,需 importLibrary 显式加载 Map/Marker。
      try {
        const maps = win.google?.maps
        if (maps?.importLibrary && !maps.Map) {
          await maps.importLibrary('maps')      // Map / InfoWindow / Circle / LatLngBounds / Marker(legacy)
        }
      } catch { /* 加载失败也 resolve,让上层 error 边界处理 */ }
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
