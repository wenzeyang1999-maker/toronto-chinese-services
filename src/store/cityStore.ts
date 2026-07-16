// ─── 当前城市 ─────────────────────────────────────────────────────────────────
// 用户当前所在/选择的开通城市，持久化到 localStorage。B1 自动定位跳转、B3 手动
// 三级选择都写这里；未来接多城市数据过滤时按 city.id 查。
import { create } from 'zustand'
import { getCityById, DEFAULT_CITY, type City } from '../data/cities'

const KEY = 'tcs_city'

interface CityState {
  city: City
  /** 是否用户手动选过（手动选择后不再被自动定位覆盖）。*/
  pinned: boolean
  setCity: (c: City, opts?: { pinned?: boolean }) => void
}

function initialCity(): City {
  if (typeof window === 'undefined') return DEFAULT_CITY
  return getCityById(localStorage.getItem(KEY)) ?? DEFAULT_CITY
}

export const useCityStore = create<CityState>((set) => ({
  city: initialCity(),
  pinned: typeof window !== 'undefined' && localStorage.getItem(KEY + '_pinned') === '1',
  setCity: (c, opts) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(KEY, c.id)
      if (opts?.pinned) localStorage.setItem(KEY + '_pinned', '1')
    }
    set((s) => ({ city: c, pinned: opts?.pinned ?? s.pinned }))
  },
}))
