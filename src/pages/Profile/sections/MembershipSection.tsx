// ─── Membership Section ────────────────────────────────────────────────────────
import { useState } from 'react'
import MembershipBadge, { LEVEL_CONFIG, type MemberLevel } from '../../../components/MembershipBadge/MembershipBadge'

const LEVEL_BENEFITS: Record<MemberLevel, string[]> = {
  L1: [
    '注册即获得绿色会员标识',
    '可发布服务帖子',
    '可接收客户询价消息',
    '基础个人主页展示',
  ],
  L2: [
    '专属黄金会员标识，更显信任感',
    '服务帖子优先展示排序',
    '主页黄金认证徽章',
    '包含所有 L1 权益',
  ],
  L3: [
    '至尊黑金标识，顶级视觉辨识度',
    '服务帖子置顶展示',
    '专属客服支持',
    '至尊认证徽章',
    '包含所有 L2 权益',
  ],
}

const UPGRADE_LEVELS: MemberLevel[] = ['L2', 'L3']

interface Props {
  level: MemberLevel
  expiresAt: string | null
}

export default function MembershipSection({ level, expiresAt }: Props) {
  const now = new Date()
  const expiry = expiresAt ? new Date(expiresAt) : null
  const daysLeft = expiry && expiry > now
    ? Math.ceil((expiry.getTime() - now.getTime()) / 86400000)
    : null
  const [hovered, setHovered] = useState<MemberLevel | null>(null)
  const cfg = LEVEL_CONFIG[level]

  return (
    <div className="space-y-6 px-4 py-6 max-w-lg mx-auto">

      {/* Current level */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">我的会员等级</h2>
        <div className={`rounded-2xl p-5 border ${
          level === 'L3'
            ? 'bg-zinc-900 border-amber-500/40'
            : level === 'L2'
            ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200'
            : 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <MembershipBadge level={level} size="lg" />
            <div className="flex-1">
              <p className={`font-bold text-base ${level === 'L3' ? 'text-amber-400' : 'text-gray-900'}`}>
                {cfg.name}
              </p>
              <p className={`text-xs mt-0.5 ${level === 'L3' ? 'text-zinc-400' : 'text-gray-500'}`}>
                当前等级
              </p>
            </div>
            {daysLeft !== null && level !== 'L1' && (
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 ${
                daysLeft <= 7
                  ? 'bg-red-100 text-red-600'
                  : level === 'L3'
                  ? 'bg-zinc-700 text-amber-300'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                剩余 {daysLeft} 天
              </span>
            )}
          </div>
          <ul className="space-y-2">
            {LEVEL_BENEFITS[level].map((b, i) => (
              <li key={i} className={`flex items-start gap-2 text-sm ${level === 'L3' ? 'text-zinc-300' : 'text-gray-700'}`}>
                <span className={`mt-0.5 flex-shrink-0 font-bold ${
                  level === 'L3' ? 'text-amber-400' : level === 'L2' ? 'text-amber-500' : 'text-emerald-500'
                }`}>✓</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Upgrade cards — only show levels above current */}
      {level !== 'L3' && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-3">升级解锁更多权益</h3>
          <div className="space-y-3">
            {UPGRADE_LEVELS.filter(l => l > level).map(upgradeLevel => {
              const ucfg = LEVEL_CONFIG[upgradeLevel]
              const isHovered = hovered === upgradeLevel
              return (
                <div
                  key={upgradeLevel}
                  onMouseEnter={() => setHovered(upgradeLevel)}
                  onMouseLeave={() => setHovered(null)}
                  className={`relative rounded-2xl border p-4 cursor-default transition-all duration-200 ${
                    upgradeLevel === 'L3'
                      ? isHovered
                        ? 'bg-zinc-900 border-amber-500/60 shadow-lg shadow-amber-900/20'
                        : 'bg-zinc-800/10 border-zinc-200'
                      : isHovered
                        ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300 shadow-md shadow-amber-100'
                        : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <MembershipBadge level={upgradeLevel} size="md" />
                      <span className={`font-semibold text-sm ${
                        upgradeLevel === 'L3' && isHovered ? 'text-amber-400' : 'text-gray-800'
                      }`}>
                        {ucfg.name}
                      </span>
                    </div>
                    <span className={`text-xs ${
                      upgradeLevel === 'L3' && isHovered ? 'text-zinc-400' : 'text-gray-400'
                    }`}>
                      悬停查看权益
                    </span>
                  </div>

                  {/* Hover benefits */}
                  {isHovered && (
                    <ul className="mt-3 space-y-1.5">
                      {LEVEL_BENEFITS[upgradeLevel].map((b, i) => (
                        <li key={i} className={`flex items-start gap-2 text-sm ${
                          upgradeLevel === 'L3' ? 'text-zinc-300' : 'text-gray-700'
                        }`}>
                          <span className={`mt-0.5 flex-shrink-0 font-bold ${
                            upgradeLevel === 'L3' ? 'text-amber-400' : 'text-amber-500'
                          }`}>✓</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Upgrade CTA */}
                  {isHovered && (
                    <p className={`mt-3 text-xs ${
                      upgradeLevel === 'L3' ? 'text-zinc-500' : 'text-gray-400'
                    }`}>
                      如需升级，请联系平台管理员
                    </p>
                  )}
                </div>
              )
            })}
          </div>
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
