// ─── Membership Section ────────────────────────────────────────────────────────
// Tier definitions come from the membership_tiers table (single source of truth).
// All three tiers are shown expanded; each tier visibly stacks on the previous.
import { useEffect, useState } from 'react'
import { Check, Crown } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import MembershipBadge, { type MemberLevel } from '../../../components/MembershipBadge/MembershipBadge'

interface Tier {
  level:      MemberLevel
  name:       string
  tagline:    string
  price_note: string
  benefits:   string[]
  sort_order: number
}

interface Props {
  level: MemberLevel
  expiresAt: string | null
}

// Per-tier visual theme
const THEME: Record<MemberLevel, {
  cardCurrent: string; cardOther: string; accent: string; nameText: string
}> = {
  L1: {
    cardCurrent: 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-300',
    cardOther:   'bg-white border-gray-200',
    accent:      'text-emerald-500',
    nameText:    'text-gray-900',
  },
  L2: {
    cardCurrent: 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300',
    cardOther:   'bg-white border-gray-200',
    accent:      'text-amber-500',
    nameText:    'text-gray-900',
  },
  L3: {
    cardCurrent: 'bg-zinc-900 border-amber-500/50',
    cardOther:   'bg-white border-gray-200',
    accent:      'text-amber-400',
    nameText:    'text-amber-400',
  },
}

const ORDER: Record<MemberLevel, number> = { L1: 1, L2: 2, L3: 3 }

export default function MembershipSection({ level, expiresAt }: Props) {
  const [tiers, setTiers] = useState<Tier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('membership_tiers')
      .select('level, name, tagline, price_note, benefits, sort_order')
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setTiers(data as Tier[])
        setLoading(false)
      })
  }, [])

  const now    = new Date()
  const expiry = expiresAt ? new Date(expiresAt) : null
  const daysLeft = expiry && expiry > now
    ? Math.ceil((expiry.getTime() - now.getTime()) / 86400000)
    : null

  if (loading) {
    return <div className="px-4 py-10 text-center text-sm text-gray-400">加载中…</div>
  }

  return (
    <div className="space-y-4 px-4 py-6 max-w-lg mx-auto">
      <div>
        <h2 className="text-lg font-bold text-gray-900">我的会员等级</h2>
        <p className="text-xs text-gray-400 mt-0.5">等级越高，权益越多 —— 每一级包含下一级全部权益</p>
      </div>

      {tiers.map((tier, idx) => {
        const isCurrent = tier.level === level
        const isOwned   = ORDER[tier.level] <= ORDER[level]   // current or below = unlocked
        const isLocked  = ORDER[tier.level] > ORDER[level]
        const dark      = tier.level === 'L3'
        const theme     = THEME[tier.level]
        const prevName  = idx > 0 ? tiers[idx - 1].name : null

        return (
          <div
            key={tier.level}
            className={`rounded-2xl border p-5 transition-all ${
              isCurrent ? theme.cardCurrent : theme.cardOther
            } ${isLocked ? 'opacity-95' : ''}`}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <MembershipBadge level={tier.level} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`font-bold text-base ${isCurrent ? theme.nameText : 'text-gray-900'}`}>
                    {tier.name}
                  </p>
                  {isCurrent && (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      dark ? 'bg-amber-400/20 text-amber-300' : 'bg-white/70 text-gray-600'
                    }`}>
                      当前等级
                    </span>
                  )}
                  {isOwned && !isCurrent && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      已包含
                    </span>
                  )}
                  {isLocked && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary-50 text-primary-600">
                      升级解锁
                    </span>
                  )}
                </div>
                <p className={`text-xs mt-0.5 ${dark && isCurrent ? 'text-zinc-400' : 'text-gray-500'}`}>
                  {tier.tagline}
                  {tier.price_note ? ` · ${tier.price_note}` : ''}
                </p>
              </div>
              {isCurrent && daysLeft !== null && tier.level !== 'L1' && (
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 ${
                  daysLeft <= 7
                    ? 'bg-red-100 text-red-600'
                    : dark ? 'bg-zinc-700 text-amber-300' : 'bg-amber-100 text-amber-700'
                }`}>
                  剩余 {daysLeft} 天
                </span>
              )}
            </div>

            {/* "includes previous tier" line */}
            {prevName && (
              <div className={`flex items-center gap-2 text-sm mb-2 ${
                dark && isCurrent ? 'text-zinc-400' : 'text-gray-500'
              }`}>
                <Check size={15} className={theme.accent} />
                <span>包含「{prevName}」全部权益</span>
              </div>
            )}

            {/* This tier's own benefits */}
            <ul className="space-y-2">
              {tier.benefits.map((b, i) => (
                <li key={i} className={`flex items-start gap-2 text-sm ${
                  dark && isCurrent ? 'text-zinc-200' : 'text-gray-700'
                }`}>
                  <Check size={15} className={`mt-0.5 flex-shrink-0 ${theme.accent}`} />
                  {b}
                </li>
              ))}
            </ul>

            {/* Upgrade hint */}
            {isLocked && (
              <p className="mt-3 text-xs text-gray-400">
                如需升级到{tier.name}，请联系平台管理员
              </p>
            )}
          </div>
        )
      })}

      {level === 'L3' && (
        <div className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-amber-400 flex items-center gap-2">
          <Crown size={16} />
          <span>你已是至尊会员，感谢你对平台的支持！</span>
        </div>
      )}
    </div>
  )
}
