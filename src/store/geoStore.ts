// ─── 访客地区 ─────────────────────────────────────────────────────────────────
// App 启动时拉一次 /api/geo 拿来源国家。中国大陆(CN)= 受限地区:可浏览,但禁注册/发布。
// 目的:提高国内同行批量复制/注册铺号的难度,为加拿大先发优势争取时间。
// 注意:这是「提高难度」而非绝对封锁(VPN 可绕);真正的数据护栏在服务端(RLS + get_contact 限流)。
import { create } from 'zustand'

const RESTRICTED = new Set(['CN'])   // 受限地区(禁注册/发布)。要加香港/其它可在此追加。

interface GeoState {
  country: string | null
  restricted: boolean
  loaded: boolean
  fetchGeo: () => Promise<void>
}

export const useGeoStore = create<GeoState>((set, get) => ({
  country: null,
  restricted: false,
  loaded: false,
  fetchGeo: async () => {
    if (get().loaded) return
    try {
      const res = await fetch('/api/geo', { cache: 'no-store' })
      const data = await res.json() as { country?: string }
      const country = (data.country ?? '').toUpperCase()
      set({ country, restricted: RESTRICTED.has(country), loaded: true })
    } catch {
      // 拿不到就当不受限(宁可放行,不误伤加拿大用户)
      set({ loaded: true })
    }
  },
}))
