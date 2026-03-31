// ─── Membership Section ────────────────────────────────────────────────────────
// Shows the user's current membership tier and a comparison of all tiers.
import MembershipBadge, { LEVEL_CONFIG, type MemberLevel } from '../../../components/MembershipBadge/MembershipBadge'

const LEVELS: MemberLevel[] = ['L1', 'L2', 'L3']

const BENEFITS: { label: string; l1: boolean; l2: boolean; l3: boolean }[] = [
  { label: '注册即获得',       l1: true,  l2: true,  l3: true  },
  { label: '发布服务帖子',     l1: true,  l2: true,  l3: true  },
  { label: '会员专属标识',     l1: true,  l2: true,  l3: true  },
  { label: '黄金认证标识',     l1: false, l2: true,  l3: true  },
  { label: '优先展示排序',     l1: false, l2: true,  l3: true  },
  { label: '至尊黑金标识',     l1: false, l2: false, l3: true  },
  { label: '置顶展示权益',     l1: false, l2: false, l3: true  },
  { label: '专属客服支持',     l1: false, l2: false, l3: true  },
]

interface Props {
  level: MemberLevel
}

export default function MembershipSection({ level }: Props) {
  const cfg = LEVEL_CONFIG[level]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">会员等级</h2>
        <p className="text-sm text-gray-500 mt-0.5">你的商家会员资质与权益</p>
      </div>

      {/* Current level card */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-100 shadow-sm p-6
                      bg-gradient-to-br from-white to-gray-50">
        <div className="flex items-start gap-4">
          {/* Big badge */}
          <div className="flex-shrink-0">
            <MembershipBadge level={level} size="lg" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-900">{cfg.name}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">{cfg.description}</p>
          </div>
        </div>

        {/* Level progress bar */}
        <div className="mt-5">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>等级进度</span>
            <span>{level === 'L3' ? '已达最高等级' : `距离 ${level === 'L1' ? 'L2' : 'L3'} 升级`}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                level === 'L1' ? 'w-1/3 bg-gradient-to-r from-emerald-400 to-emerald-500' :
                level === 'L2' ? 'w-2/3 bg-gradient-to-r from-amber-400 to-yellow-500' :
                                 'w-full  bg-gradient-to-r from-zinc-700 to-black'
              }`}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1.5">
            <span>L1</span>
            <span>L2</span>
            <span>L3</span>
          </div>
        </div>
      </div>

      {/* Tier comparison table */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">等级对比</h3>
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-100">
            <div className="px-4 py-3 text-xs font-medium text-gray-500">权益</div>
            {LEVELS.map((l) => (
              <div key={l} className={`px-2 py-3 text-center ${l === level ? 'bg-white' : ''}`}>
                <MembershipBadge level={l} size="sm" />
              </div>
            ))}
          </div>
          {/* Rows */}
          {BENEFITS.map((row, i) => (
            <div
              key={i}
              className={`grid grid-cols-4 border-b border-gray-50 last:border-0
                          ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
            >
              <div className="px-4 py-2.5 text-xs text-gray-600">{row.label}</div>
              {([row.l1, row.l2, row.l3] as boolean[]).map((has, j) => (
                <div key={j} className={`py-2.5 text-center text-sm
                                         ${LEVELS[j] === level ? 'bg-white' : ''}`}>
                  {has
                    ? <span className="text-emerald-500 font-bold">✓</span>
                    : <span className="text-gray-200">—</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade note */}
      {level !== 'L3' && (
        <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-700">
          想升级到更高等级？请联系平台管理员。
        </div>
      )}
      {level === 'L3' && (
        <div className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-amber-400 flex items-center gap-2">
          <span>♛</span>
          <span>你已是至尊会员，感谢你对平台的支持！</span>
        </div>
      )}
    </div>
  )
}
