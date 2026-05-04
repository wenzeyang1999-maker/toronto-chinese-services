// ─── Saves Section (我的收藏) ──────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Wrench, Briefcase, Home, ShoppingBag, Calendar, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useSavesStore } from '../../../store/savesStore'
import { SectionSkeleton } from '../../../components/Skeleton/Skeleton'

type TargetType = 'service' | 'job' | 'property' | 'secondhand' | 'event'
type TabKey = 'all' | TargetType

interface SavedItem {
  id: string
  target_type: TargetType
  target_id: string
  created_at: string
  title: string
  subtitle: string
  emoji: string
  path: string
}

const TYPE_CONFIG: Record<TargetType, { label: string; icon: React.ReactNode; emoji: string }> = {
  service:    { label: '服务',  icon: <Wrench      size={14} />, emoji: '🔧' },
  job:        { label: '招聘',  icon: <Briefcase   size={14} />, emoji: '💼' },
  property:   { label: '房源',  icon: <Home        size={14} />, emoji: '🏠' },
  secondhand: { label: '闲置',  icon: <ShoppingBag size={14} />, emoji: '🛒' },
  event:      { label: '活动',  icon: <Calendar    size={14} />, emoji: '🎉' },
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',        label: '全部' },
  { key: 'service',    label: '服务' },
  { key: 'job',        label: '招聘' },
  { key: 'property',   label: '房源' },
  { key: 'secondhand', label: '闲置' },
  { key: 'event',      label: '活动' },
]

const TABLE_MAP: Record<TargetType, string> = {
  service:    'services',
  job:        'jobs',
  property:   'properties',
  secondhand: 'secondhand',
  event:      'events',
}
const PATH_PREFIX: Record<TargetType, string> = {
  service:    '/service',
  job:        '/jobs',
  property:   '/realestate',
  secondhand: '/secondhand',
  event:      '/events',
}

export default function SavesSection() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { fetchSaves, toggleSave } = useSavesStore()

  const [tab,     setTab]     = useState<TabKey>('all')
  const [items,   setItems]   = useState<SavedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadSaves()
  }, [user])

  async function loadSaves() {
    if (!user) return
    setLoading(true)

    const { data: saveRows } = await supabase
      .from('saves')
      .select('id, target_type, target_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!saveRows || saveRows.length === 0) {
      setItems([]); setLoading(false); return
    }

    // Group by type and fetch titles in parallel
    const byType: Record<string, string[]> = {}
    for (const row of saveRows) {
      if (!byType[row.target_type]) byType[row.target_type] = []
      byType[row.target_type].push(row.target_id)
    }

    const titleMap: Record<string, string> = {}
    await Promise.all(
      (Object.entries(byType) as [TargetType, string[]][]).map(async ([type, ids]) => {
        const table = TABLE_MAP[type]
        const { data } = await supabase.from(table).select('id, title').in('id', ids)
        if (data) data.forEach((r: any) => { titleMap[`${type}:${r.id}`] = r.title })
      })
    )

    const mapped: SavedItem[] = saveRows.map((row: any) => {
      const type = row.target_type as TargetType
      const title = titleMap[`${type}:${row.target_id}`] ?? '（已删除）'
      return {
        id:          row.id,
        target_type: type,
        target_id:   row.target_id,
        created_at:  row.created_at,
        title,
        subtitle:    row.created_at.slice(0, 10),
        emoji:       TYPE_CONFIG[type].emoji,
        path:        `${PATH_PREFIX[type]}/${row.target_id}`,
      }
    })

    setItems(mapped)
    // Also refresh the store
    await fetchSaves(user.id)
    setLoading(false)
  }

  async function handleRemove(item: SavedItem) {
    if (!user) return
    await toggleSave(user.id, item.target_type, item.target_id)
    setItems(prev => prev.filter(i => i.id !== item.id))
  }

  const filtered = tab === 'all' ? items : items.filter(i => i.target_type === tab)
  const counts: Record<TabKey, number> = {
    all:        items.length,
    service:    items.filter(i => i.target_type === 'service').length,
    job:        items.filter(i => i.target_type === 'job').length,
    property:   items.filter(i => i.target_type === 'property').length,
    secondhand: items.filter(i => i.target_type === 'secondhand').length,
    event:      items.filter(i => i.target_type === 'event').length,
  }

  if (loading) return <SectionSkeleton rows={5} />

  return (
    <div className="flex-1 px-4 py-5 max-w-md lg:max-w-none mx-auto w-full">

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-4 overflow-x-auto scrollbar-hide">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1 flex-shrink-0 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t.key ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {counts[t.key] > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                tab === t.key ? 'bg-primary-100 text-primary-600' : 'bg-gray-200 text-gray-500'
              }`}>{counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
          <Heart size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-600 font-medium">还没有收藏任何内容</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">在详情页点击 ♡ 即可收藏</p>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-2xl hover:bg-primary-700 transition-colors"
          >
            去发现服务
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((item, i) => (
              <motion.div key={item.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ delay: i * 0.03 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 px-4 py-3.5"
              >
                <span className="text-xl flex-shrink-0">{item.emoji}</span>
                <button onClick={() => navigate(item.path)}
                  className="flex-1 min-w-0 text-left hover:opacity-70 transition-opacity">
                  <p className="text-sm font-semibold text-gray-800 truncate">{item.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {TYPE_CONFIG[item.target_type].label} · {item.subtitle}
                  </p>
                </button>
                <button onClick={() => handleRemove(item)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-300 hover:bg-red-50 hover:text-red-400 transition-colors flex-shrink-0">
                  <Trash2 size={15} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
