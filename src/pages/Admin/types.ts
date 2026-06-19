// ─── Admin Page shared types & label maps ────────────────────────────────────
// Extracted from AdminPage.tsx so individual tab components can import them.

export interface ReportRow {
  id: string
  reason: string
  status: string
  created_at: string
  review: {
    id: string
    rating: number
    comment: string | null
    service: { id: string; title: string } | null
  } | null
  reporter: { id: string; name: string } | null
}

export interface Stats {
  users: number
  services: number
  jobs: number
  properties: number
  secondhand: number
  events: number
  pending_reports: number
  pending_content_reports: number
  pending_verifications: number
}

export interface VerificationRow {
  id: string
  name: string
  email: string
  qualification_images: string[]
  verification_status: string
  created_at: string
}

export interface PromotedRow {
  id: string
  title: string
  table: 'services' | 'jobs' | 'properties' | 'secondhand' | 'events'
  is_promoted: boolean
  created_at: string
}

export interface InquiryMatch {
  id: string
  provider_name: string
  provider_email: string
  email_sent: boolean
}

export interface InquiryRow {
  id: string
  category_id: string
  description: string
  budget: string | null
  timing: string
  name: string
  phone: string
  wechat: string | null
  status: string
  created_at: string
  matches: InquiryMatch[]
}

export interface ContentReportRow {
  id: string
  content_type: 'community_post' | 'community_comment' | 'service' | 'secondhand' | 'job' | 'property' | 'event'
  content_id: string
  content_title: string
  reason: string
  status: string
  created_at: string
  reporter: { id: string; name: string } | null
}

export interface PromoRequestRow {
  id: string
  note: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at: string | null
  service: { id: string; title: string } | null
  provider: { id: string; name: string; email: string } | null
}

export interface AuditLogRow {
  id: string
  action_type: string
  target_type: string
  target_id: string | null
  details: Record<string, unknown>
  created_at: string
  actor: { id: string; name: string; email: string } | null
}

export interface MemberRow {
  id: string
  name: string
  email: string
  membership_level: 'L1' | 'L2' | 'L3'
  membership_expires_at: string | null
}

export interface NewServiceRow {
  id: string
  title: string
  description: string
  price: number | null
  category_id: string
  is_available: boolean
  is_promoted: boolean
  created_at: string
  provider: { id: string; name: string; email: string } | null
}

export interface UserRow {
  id: string
  name: string
  email: string
  role: 'user' | 'provider' | 'admin' | 'banned'
  created_at: string
  is_email_verified: boolean
  business_verified: boolean
  referral_code: string | null
}

export interface AdminNotice {
  type: 'success' | 'error'
  text: string
}

// Target of the shared "delete user" confirmation modal (rendered at AdminPage
// root). onDeleted lets whichever tab opened it refresh its own list on success.
export interface DeleteTarget {
  id: string
  name: string
  email: string
  onDeleted?: () => void
}

export const REASON_LABEL: Record<string, string> = {
  irrelevant: '内容无关',
  malicious:  '恶意攻击',
  fake:       '虚假评价',
  spam:       '垃圾广告',
  other:      '其他',
}

export const INQUIRY_STATUS_LABEL: Record<InquiryRow['status'], string> = {
  open: '待处理',
  matched: '已匹配',
  closed: '已关闭',
}

export const ADMIN_ACTION_LABEL: Record<string, string> = {
  promote_on: '设为推广',
  promote_off: '取消推广',
  review_report_dismissed: '忽略评价举报',
  review_removed: '删除评价',
  verification_approved: '通过认证',
  verification_rejected: '拒绝认证',
  community_post_deleted: '删除社区帖子',
  inquiry_status_updated: '更新询价状态',
  membership_granted: '授予会员',
  membership_revoked: '撤销会员',
  service_takedown: '下架服务',
  service_restored: '恢复服务',
  service_bulk_takedown: '批量下架服务',
  service_content_updated: '编辑服务内容',
  user_role_updated: '修改用户角色',
  community_report_dismissed: '忽略社区举报',
  community_report_removed: '删除被举报帖子',
  community_comment_report_dismissed: '忽略评论举报',
  community_comment_report_removed: '删除被举报评论',
  takedown_job: '下架招聘',
  takedown_property: '下架房源',
  takedown_event: '下架活动',
}
