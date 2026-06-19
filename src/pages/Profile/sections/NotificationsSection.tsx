// ─── Notification Preferences ─────────────────────────────────────────────────
// Lets users toggle which push events they want to receive.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, MessageSquare, ClipboardList, Star, Megaphone, Search as SearchIcon, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { toast } from '../../../lib/toast'
import {
  getSavedSearches,
  removeSavedSearch,
  type SavedSearch,
} from '../../../lib/savedSearches'

interface NotifPrefs {
  messages:      boolean
  inquiry_match: boolean
  review:        boolean
  platform:      boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  messages:      true,
  inquiry_match: true,
  review:        true,
  platform:      true,
}

const PREF_CONFIG: {
  key: keyof NotifPrefs
  icon: React.ReactNode
  label: string
  sub: string
}[] = [
  {
    key:   'messages',
    icon:  <MessageSquare size={18} className="text-primary-500" />,
    label: '新消息通知',
    sub:   '有人给你发起对话时推送',
  },
  {
    key:   'inquiry_match',
    icon:  <ClipboardList size={18} className="text-indigo-500" />,
    label: '报价匹配通知',
    sub:   '有服务商响应你的报价请求时推送',
  },
  {
    key:   'review',
    icon:  <Star size={18} className="text-yellow-500" />,
    label: '评价通知',
    sub:   '有人给你的服务留下评价时推送',
  },
  {
    key:   'platform',
    icon:  <Megaphone size={18} className="text-emerald-500" />,
    label: '平台公告',
    sub:   '平台重要更新或活动通知',
  },
]

export default function NotificationsSection() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [prefs,   setPrefs]   = useState<NotifPrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [permState, setPermState] = useState<NotificationPermission | 'unsupported'>('default')
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])

  useEffect(() => {
    void getSavedSearches().then(setSavedSearches)
  }, [user])

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermState(Notification.permission)
    } else {
      setPermState('unsupported')
    }
  }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('users').select('notification_prefs').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.notification_prefs) {
          setPrefs({ ...DEFAULT_PREFS, ...(data.notification_prefs as Partial<NotifPrefs>) })
        }
        setLoading(false)
      })
  }, [user])

  async function toggle(key: keyof NotifPrefs) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setSaving(true)
    const { error } = await supabase.from('users')
      .update({ notification_prefs: next })
      .eq('id', user!.id)
    setSaving(false)
    if (error) {
      setPrefs(prefs) // rollback
      toast('保存失败，请稍后再试', 'error')
    }
  }

  async function handleRemoveSavedSearch(id: string) {
    await removeSavedSearch(id)
    setSavedSearches(await getSavedSearches())
    toast('已取消订阅', 'success')
  }

  async function requestPermission() {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setPermState(result)
    if (result === 'granted') toast('通知权限已开启 ✓', 'success')
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-1/2 mb-4" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 py-3 border-t border-gray-50">
              <div className="w-9 h-9 bg-gray-100 rounded-xl flex-shrink-0" />
              <div className="flex-1">
                <div className="h-3.5 bg-gray-100 rounded w-2/3 mb-1.5" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
              <div className="w-11 h-6 bg-gray-100 rounded-full flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-1">
          <Bell size={20} className="text-primary-500" />
          <h2 className="text-base font-semibold text-gray-900">推送通知设置</h2>
          {saving && <span className="text-xs text-gray-400 ml-auto">保存中…</span>}
        </div>
        <p className="text-xs text-gray-400 mb-5">分别控制每类事件的推送，随时可更改</p>

        {/* Browser permission banner */}
        {permState === 'denied' && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            浏览器通知权限已被拒绝。请在浏览器设置中手动开启，否则无法收到推送。
          </div>
        )}
        {permState === 'default' && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-blue-700 flex-1">开启浏览器通知权限以接收推送</p>
            <button onClick={requestPermission}
              className="text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg flex-shrink-0">
              开启
            </button>
          </div>
        )}
        {permState === 'unsupported' && (
          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500">
            当前浏览器不支持推送通知。
          </div>
        )}

        <div className="divide-y divide-gray-50">
          {PREF_CONFIG.map(({ key, icon, label, sub }) => (
            <div key={key} className="flex items-center gap-3 py-3.5">
              <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </div>
              {/* Toggle switch */}
              <button
                onClick={() => toggle(key)}
                disabled={saving || permState === 'denied' || permState === 'unsupported'}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0
                  ${prefs[key] && permState === 'granted'
                    ? 'bg-primary-600'
                    : 'bg-gray-200'}
                  disabled:opacity-50`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                  ${prefs[key] && permState === 'granted' ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 px-1">
        推送通知需要浏览器权限支持。Safari / iOS 需在"添加到主屏幕"后才能收到推送。
      </p>

      {/* ── Saved Searches ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-1">
          <SearchIcon size={20} className="text-primary-500" />
          <h2 className="text-base font-semibold text-gray-900">已订阅的搜索</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">有新的匹配结果时在通知中心提醒你</p>

        {savedSearches.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            暂无订阅。在搜索页点击"订阅通知"即可添加。
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {savedSearches.map(s => (
              <div key={s.id} className="flex items-center gap-3 py-3">
                <button
                  onClick={() => navigate(`/search?q=${encodeURIComponent(s.keyword)}${s.category ? `&cat=${s.category}` : ''}`)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.label}</p>
                    {s.newCount > 0 && (
                      <span className="flex-shrink-0 text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                        {s.newCount > 99 ? '99+' : s.newCount} 新
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    订阅于 {new Date(s.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                  </p>
                </button>
                <button
                  onClick={() => handleRemoveSavedSearch(s.id)}
                  className="flex-shrink-0 p-2 text-gray-300 hover:text-red-400 transition-colors rounded-lg"
                  aria-label="取消订阅"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
