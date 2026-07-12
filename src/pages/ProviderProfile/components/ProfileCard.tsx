import { motion } from 'framer-motion'
import { CheckCircle2, Clock, ExternalLink, MessageSquare, Phone, ShieldCheck, BadgeCheck, Wifi } from 'lucide-react'
import type { ProviderUser } from '../types'
import MembershipBadge from '../../../components/MembershipBadge/MembershipBadge'
import CreditStars from '../../../components/CreditStars/CreditStars'
import FollowButton from '../../../components/FollowButton/FollowButton'
import ReplyTimeBadge from '../../../components/ReplyTimeBadge/ReplyTimeBadge'
import ImgFallback from '../../../components/ImgFallback/ImgFallback'
import { SOCIAL_PLATFORMS } from '../../../lib/socialPlatforms'

interface Props {
  provider: ProviderUser
  followerCount: number
  isOwnProfile: boolean
  joinedMonth: string
  orderCount?: number
  onMessage: () => void
  onCopyWechat: () => void
}

export default function ProfileCard({ provider, followerCount, isOwnProfile, joinedMonth, orderCount = 0, onMessage, onCopyWechat }: Props) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">

      {/* Avatar + name row */}
      <div className="flex items-center gap-4">
        {provider.avatar_url ? (
          <ImgFallback
            src={provider.avatar_url}
            alt={provider.name}
            className="w-20 h-20 rounded-full object-cover flex-shrink-0 border border-gray-100"
            fallback={
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                              flex items-center justify-center text-white font-bold text-3xl flex-shrink-0">
                {provider.name.charAt(0)}
              </div>
            }
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                          flex items-center justify-center text-white font-bold text-3xl flex-shrink-0">
            {provider.name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">{provider.name}</h1>
            <MembershipBadge level={provider.membership_level} size="md" />
          </div>
          <div className="mt-1">
            <CreditStars
              input={{
                emailVerified:        provider.is_email_verified,
                phoneVerified:        provider.phone_verified,
                idOrBusinessVerified: provider.business_verified,
                creditPenalty:        provider.credit_penalty,
              }}
            />
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
            <Clock size={12} />
            <span>加入于 {joinedMonth}</span>
            {orderCount > 0 && (
              <span className="ml-1 inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                已成交 {orderCount} 单
              </span>
            )}
          </div>
          <div className="mt-1.5">
            <ReplyTimeBadge
              avgReplyHours={provider.avg_reply_hours}
              joinedAt={provider.created_at}
              lastSeenAt={provider.last_seen_at}
            />
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-2 mt-2">
            {provider.is_online && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold text-green-700 bg-green-50 border border-green-200">
                <Wifi size={10} />
                在线接单
              </span>
            )}
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium
              ${provider.business_type === 'business' ? 'text-blue-700 bg-blue-50 border border-blue-200' : 'text-gray-500 bg-gray-100'}`}>
              {provider.business_type === 'business' ? '🏢 企业商户' : '👤 个人服务商'}
            </span>
          </div>

          {/* Trust bar */}
          {(provider.business_verified || provider.phone_verified ||
            provider.is_email_verified || provider.qualification_images.length > 0) && (
            <div className="mt-2.5 pt-2.5 border-t border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">认证信息</p>
              <div className="flex flex-wrap gap-1.5">
                {provider.business_verified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    <BadgeCheck size={11} /> 商户认证
                  </span>
                )}
                {provider.phone_verified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-600 border border-sky-200">
                    <Phone size={11} /> 手机已验证
                  </span>
                )}
                {provider.is_email_verified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                    <CheckCircle2 size={11} /> 邮箱已验证
                  </span>
                )}
                {provider.qualification_images.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-50 text-violet-600 border border-violet-200">
                    <ShieldCheck size={11} /> {provider.qualification_images.length} 张资质证书
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      {provider.bio && (
        <p className="mt-4 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{provider.bio}</p>
      )}

      {/* Skill tags */}
      {provider.skill_tags.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-bold text-gray-700 mb-2.5">业务范围</p>
          <div className="flex flex-wrap gap-2">
            {provider.skill_tags.map((tag) => (
              <span key={tag}
                className="text-sm px-4 py-2 rounded-xl bg-primary-100 text-primary-700 border border-primary-200 font-semibold">
                # {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Qualification & equipment */}
      {(provider.qualification_note.trim() || provider.qualification_images.length > 0) && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-400 mb-2">资质与设备</p>
          {provider.qualification_note.trim() && (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-2">
              {provider.qualification_note}
            </p>
          )}
          {provider.qualification_images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {provider.qualification_images.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50 hover:opacity-90 transition-opacity">
                  <img src={url} alt={`资质与设备 ${i + 1}`} loading="lazy" className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contact info */}
      {(provider.email || provider.phone || provider.wechat) && (
        <div className="mt-5 pt-4 border-t border-gray-100 space-y-2.5">
          {provider.email && (
            <a href={`mailto:${provider.email}`}
              className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-primary-600 transition-colors">
              <span className="text-lg">📧</span>
              <span className="truncate">{provider.email}</span>
            </a>
          )}
          {provider.phone && (
            <a href={`tel:${provider.phone}`}
              className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-primary-600 transition-colors">
              <Phone size={16} className="text-primary-400 flex-shrink-0" />
              <span>{provider.phone}</span>
            </a>
          )}
          {provider.wechat && (
            <button onClick={onCopyWechat}
              className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-primary-600 transition-colors w-full text-left">
              <span className="text-lg">💬</span>
              <span>{provider.wechat}</span>
              <span className="text-xs text-gray-400 ml-1">（点击复制）</span>
            </button>
          )}
        </div>
      )}

      {/* Social links */}
      {SOCIAL_PLATFORMS.some(p => provider.social_links[p.key]?.trim()) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SOCIAL_PLATFORMS.filter(p => provider.social_links[p.key]?.trim()).map(p => {
            const url = p.getUrl(provider.social_links[p.key])
            return url ? (
              <a key={p.key} href={url} target="_blank" rel="noopener noreferrer"
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${p.color}`}>
                <span>{p.icon}</span>
                <span>{p.label}</span>
                <ExternalLink size={10} />
              </a>
            ) : (
              <span key={p.key}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${p.color}`}>
                <span>{p.icon}</span>
                <span>{provider.social_links[p.key]}</span>
              </span>
            )
          })}
        </div>
      )}

      {/* Follower count */}
      {followerCount > 0 && (
        <p className="mt-3 text-xs text-gray-400 flex items-center gap-1">
          <span className="font-semibold text-gray-600">{followerCount}</span> 位粉丝关注
        </p>
      )}

      {/* Action buttons */}
      {!isOwnProfile && (
        <div className="mt-5 flex gap-3">
          <button onClick={onMessage}
            className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white
                       py-3 rounded-2xl font-medium hover:bg-primary-700 active:scale-[0.98] transition-all">
            <MessageSquare size={18} />
            发消息
          </button>
          <FollowButton providerId={provider.id} />
        </div>
      )}
    </motion.div>
  )
}
