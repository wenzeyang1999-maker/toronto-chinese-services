// Syncs a flat filter object with URL search params.
// On mount, reads from URL and hydrates the store.
// On filter change, writes back to URL (replace, not push).
import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFilters = Record<string, any>

export function useUrlFilters<T extends AnyFilters>(
  filters: T,
  setFilters: (f: Partial<T>) => void,
  keys: (keyof T & string)[],
  options: { numericKeys?: string[]; boolKeys?: string[] } = {},
) {
  const [, setSearchParams] = useSearchParams()
  const { numericKeys = [], boolKeys = [] } = options
  const mounted = useRef(false)

  // Mount: hydrate store from URL once
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromUrl: Partial<T> = {}
    for (const key of keys) {
      const raw = params.get(key)
      if (raw == null) continue
      if (numericKeys.includes(key)) {
        const n = Number(raw)
        if (!isNaN(n)) fromUrl[key] = n as T[typeof key]
      } else if (boolKeys.includes(key)) {
        fromUrl[key] = (raw === 'true') as T[typeof key]
      } else {
        fromUrl[key] = raw as T[typeof key]
      }
    }
    if (Object.keys(fromUrl).length > 0) setFilters(fromUrl)
    mounted.current = true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After mount: write current filters to URL when they change
  const depsKey = keys.map((k) => String(filters[k] ?? '')).join('\x00')
  useEffect(() => {
    if (!mounted.current) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const key of keys) {
          const val = filters[key]
          if (val !== undefined && val !== '' && val !== false) {
            next.set(key, String(val))
          } else {
            next.delete(key)
          }
        }
        return next
      },
      { replace: true },
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey])
}
