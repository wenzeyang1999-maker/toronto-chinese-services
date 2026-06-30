// ─── Shared report / complaint reason taxonomies ───────────────────────────
// Single source of truth so every report form uses the same keys + labels.
// Previously these were redefined (with drifting wording) in 6 separate files.

// Content reports — community posts, services, secondhand listings.
export const CONTENT_REPORT_REASONS = [
  { key: 'fake',       label: '虚假信息' },
  { key: 'spam',       label: '垃圾广告' },
  { key: 'malicious',  label: '欺诈/恶意' },
  { key: 'irrelevant', label: '内容无关' },
  { key: 'other',      label: '其他' },
] as const

// Review reports — about a posted review (distinct wording from content reports).
export const REVIEW_REPORT_REASONS: { key: string; label: string }[] = [
  { key: 'malicious',  label: '恶意差评 / 竞争对手' },
  { key: 'fake',       label: '虚假评价 / 未使用过服务' },
  { key: 'irrelevant', label: '内容无关 / 跑题' },
  { key: 'spam',       label: '垃圾广告' },
  { key: 'other',      label: '其他原因' },
]

// Complaint tags — the AI assistant's broader report/complaint form.
export const COMPLAINT_REASON_TAGS = [
  '虚假信息', '骚扰/辱骂', '诈骗', '违法内容', '政治敏感', '侵权', '其他',
] as const

// key → label lookup for content reports (used when rendering a stored reason).
export const CONTENT_REPORT_LABEL: Record<string, string> = Object.fromEntries(
  CONTENT_REPORT_REASONS.map((r) => [r.key, r.label])
)
