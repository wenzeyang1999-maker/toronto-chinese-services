// ─── 未读消息(全局共享)────────────────────────────────────────────────────────
// 之前 MessagesButton 和 BottomNav 各开一个 realtime 频道 + 各查一次 conversations,
// 干的是同一件事(重复)。这里合并成:全局一个频道 + 一次查询,两个组件共用。
// 用引用计数管理频道:第一个消费者挂载时建立,最后一个卸载时关闭,减少 Realtime 订阅
// 开关次数(realtime.subscription 写入是免费版 Disk IO 的大头)。
import { create } from 'zustand'
import { useEffect } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'

interface UnreadState { count: number; setCount: (n: number) => void }
const useStore = create<UnreadState>((set) => ({ count: 0, setCount: (n) => set({ count: n }) }))

let channel: RealtimeChannel | null = null
let subscribers = 0
let boundUserId: string | null = null

async function refresh(userId: string) {
  const { data } = await supabase
    .from('conversations')
    .select('client_unread, provider_unread, client_id')
    .or(`client_id.eq.${userId},provider_id.eq.${userId}`)
  if (!data) return
  const total = data.reduce((sum, r) =>
    sum + ((r.client_id === userId ? r.client_unread : r.provider_unread) ?? 0), 0)
  useStore.getState().setCount(total)
}

function teardown() {
  if (channel) { supabase.removeChannel(channel); channel = null }
  boundUserId = null
}

/** 返回当前用户的未读消息总数;多个组件调用只会共享一个频道+一次查询。 */
export function useUnreadCount(): number {
  const count = useStore((s) => s.count)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!user) { teardown(); useStore.getState().setCount(0); return }
    const uid = user.id
    subscribers++

    // 用户变了 → 重建频道(旧频道闭包绑的是旧 uid)
    if (boundUserId !== uid) { teardown(); boundUserId = uid }
    void refresh(uid)
    if (!channel) {
      channel = supabase
        .channel('unread-shared')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' },
          () => { void refresh(uid) })
        .subscribe()
    }

    return () => {
      subscribers = Math.max(0, subscribers - 1)
      if (subscribers === 0) teardown()   // 最后一个消费者卸载才关频道
    }
  }, [user])

  return count
}
