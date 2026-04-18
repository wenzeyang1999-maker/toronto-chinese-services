import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

interface NotificationRow {
  id: string
  title: string
  body: string | null
  link_url: string | null
  read_at: string | null
  created_at: string
  type: string
}

interface AdminNotificationsBellProps {
  compact?: boolean
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16).replace('T', ' ')

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))
  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} 小时前`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays} 天前`
  return value.slice(0, 16).replace('T', ' ')
}

export default function AdminNotificationsBell({ compact = false }: AdminNotificationsBellProps) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const panelRef = useRef<HTMLDivElement>(null)
  const [role, setRole] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications]
  )

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setRole(null)
      setNotifications([])
      return
    }

    setLoading(true)
    const [{ data: profile }, { data, error }] = await Promise.all([
      supabase.from('users').select('role').eq('id', user.id).single(),
      supabase
        .from('notifications')
        .select('id, title, body, link_url, read_at, created_at, type')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(12),
    ])

    setRole(profile?.role ?? null)
    if (error) {
      console.warn('[admin-notifications] load failed:', error.message)
      setNotifications([])
      setLoading(false)
      return
    }

    setNotifications((data ?? []) as NotificationRow[])
    setLoading(false)
  }, [user])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`admin-notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
        () => { void loadNotifications() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, loadNotifications])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function markAsRead(notificationId: string) {
    setNotifications((prev) => prev.map((item) => (
      item.id === notificationId ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item
    )))

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)

    if (error) {
      console.warn('[admin-notifications] mark read failed:', error.message)
      void loadNotifications()
    }
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter((item) => !item.read_at).map((item) => item.id)
    if (unreadIds.length === 0) return

    setNotifications((prev) => prev.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })))
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)

    if (error) {
      console.warn('[admin-notifications] mark all read failed:', error.message)
      void loadNotifications()
    }
  }

  async function openNotification(item: NotificationRow) {
    if (!item.read_at) await markAsRead(item.id)
    setOpen(false)
    navigate(item.link_url || '/admin')
  }

  if (!user || role !== 'admin') return null

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((value) => !value)}
        className={`relative rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors ${
          compact ? 'p-2' : 'px-3 py-2'
        }`}
        aria-label="管理员提醒"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] max-w-[calc(100vw-24px)] bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800">管理员提醒</p>
              <p className="text-xs text-gray-400">社区举报和后台动作提醒会显示在这里</p>
            </div>
            <button
              onClick={() => void markAllAsRead()}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
            >
              <CheckCheck size={14} />
              全部已读
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">加载中…</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">暂无提醒</div>
            ) : notifications.map((item) => (
              <button
                key={item.id}
                onClick={() => void openNotification(item)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                  item.read_at ? 'bg-white' : 'bg-orange-50/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1 w-2 h-2 rounded-full ${item.read_at ? 'bg-gray-200' : 'bg-orange-500'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800 truncate">{item.title}</p>
                      <span className="text-[11px] text-gray-400 ml-auto shrink-0">{formatTime(item.created_at)}</span>
                    </div>
                    {item.body && (
                      <p className="mt-1 text-xs text-gray-500 leading-relaxed line-clamp-2">{item.body}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
