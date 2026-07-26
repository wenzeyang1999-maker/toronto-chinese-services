// ─── Collection Section (我的收藏) ────────────────────────────────────────────
// 「我的收藏」与「我的关注」合并：本质都是"存起来以后看"。
//   · 收藏内容 = 收藏的服务 / 帖子 / 招聘 / 房源 / 闲置 / 活动
//   · 关注商家 = 关注的商家 / 用户
// 顶部分段切换，各自复用原有的 SavesSection / FollowsSection。
import { useState } from 'react'
import { Heart, UserCheck } from 'lucide-react'
import SavesSection from './SavesSection'
import FollowsSection from './FollowsSection'

type Seg = 'saves' | 'follows'

export default function CollectionSection({ initialSeg = 'saves' }: { initialSeg?: Seg }) {
  const [seg, setSeg] = useState<Seg>(initialSeg)

  const SEGMENTS: { key: Seg; label: string; icon: React.ReactNode }[] = [
    { key: 'saves',   label: '收藏内容', icon: <Heart     size={15} /> },
    { key: 'follows', label: '关注商家', icon: <UserCheck size={15} /> },
  ]

  return (
    <div>
      {/* 分段切换 */}
      <div className="flex gap-2 mb-4">
        {SEGMENTS.map(s => {
          const active = seg === s.key
          return (
            <button
              key={s.key}
              onClick={() => setSeg(s.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-sm font-semibold transition-colors ${
                active
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          )
        })}
      </div>

      {seg === 'saves' ? <SavesSection /> : <FollowsSection />}
    </div>
  )
}
