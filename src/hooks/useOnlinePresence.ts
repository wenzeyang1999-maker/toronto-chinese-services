// ─── 在线接单「心跳」──────────────────────────────────────────────────────────
// 问题背景:UI 的「上线接单」由本地 mode(localStorage)驱动,只有点击切换那一下
// 才写数据库。重开 App 时界面显示上线、但 DB 里 is_online 早已被小时级 cron
// (last_seen>24h 自动下线)关掉,且没有心跳刷新 last_seen → 地图搜不到、
// 「查看全部商家」显示「暂未上线」。
//
// 修复:只要处于「服务商模式(=上线接单)」且已登录,就:
//   1) 立即把 is_online=true + last_seen=now 同步回 DB(并尽量补坐标),
//   2) 每 3 分钟心跳刷新 last_seen(维持在地图上,避开 2h 过滤 / 24h cron),
//   3) 切回前台时补一次。
// 翻回「用户模式」由 Profile.switchMode 显式写 is_online=false,这里不管。
import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useOnlineModeStore } from '../store/onlineModeStore'
import { offsetLocation } from '../lib/geo'

const HEARTBEAT_MS = 3 * 60 * 1000

export function useOnlinePresence() {
  const user   = useAuthStore((s) => s.user)
  const online = useOnlineModeStore((s) => s.online)
  const gotCoordsRef = useRef(false)

  useEffect(() => {
    if (!user || !online) return
    const uid = user.id
    let cancelled = false

    // 尽量拿一次(缓存的)定位,补上模糊坐标 —— 拿不到也不阻塞上线。
    async function beat(withCoords: boolean) {
      const patch: Record<string, unknown> = { is_online: true, last_seen_at: new Date().toISOString() }
      if (withCoords && !gotCoordsRef.current && typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, maximumAge: 10 * 60 * 1000 }))
          const f = offsetLocation(pos.coords.latitude, pos.coords.longitude)
          patch.online_lat = f.lat; patch.online_lng = f.lng
          gotCoordsRef.current = true
        } catch { /* 无定位:仍上线,只是地图暂不显示 */ }
      }
      if (cancelled) return
      await supabase.from('users').update(patch).eq('id', uid)
    }

    void beat(true)                                    // 进来立刻同步一次(带坐标)
    const iv = window.setInterval(() => void beat(false), HEARTBEAT_MS)  // 心跳只刷 last_seen
    const onVis = () => { if (document.visibilityState === 'visible') void beat(false) }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelled = true
      window.clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [user, online])
}
