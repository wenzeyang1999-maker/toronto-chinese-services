// ─── Audit log detail formatting ─────────────────────────────────────────────
// Pure helpers extracted from AdminPage.tsx — translate audit-log detail keys
// and values into human-readable Chinese and render them.

export function formatLogKey(key: string): string {
  const labels: Record<string, string> = {
    role: '角色',
    status: '状态',
    level: '会员等级',
    membership_expires_at: '到期时间',
    ids: '批量对象',
    report_id: '举报 ID',
    post_id: '帖子 ID',
    comment_id: '评论 ID',
    table: '来源表',
  }
  return labels[key] ?? key.replace(/_/g, ' ')
}

export function formatLogValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '无'
  if (Array.isArray(value)) return value.join('、')
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'string') {
    if (value === 'open') return '待处理'
    if (value === 'matched') return '已匹配'
    if (value === 'closed') return '已关闭'
    if (value === 'user') return '普通用户'
    if (value === 'provider') return '服务商'
    if (value === 'admin') return '管理员'
    if (value === 'banned') return '已封禁'
    return value
  }
  return String(value)
}

export function renderAuditDetails(details: Record<string, unknown>) {
  const entries = Object.entries(details ?? {}).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0
    return value !== null && value !== undefined && value !== ''
  })

  if (entries.length === 0) return null

  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-start gap-3 text-xs">
          <span className="w-24 shrink-0 text-gray-400">{formatLogKey(key)}</span>
          <span className="text-gray-700 break-all">{formatLogValue(value)}</span>
        </div>
      ))}
    </div>
  )
}
