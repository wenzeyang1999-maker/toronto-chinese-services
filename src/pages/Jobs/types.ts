// ─── Jobs Module — Type Definitions ──────────────────────────────────────────

export type ListingType = 'hiring' | 'seeking'

export type JobCategory =
  | 'food'
  | 'retail'
  | 'it'
  | 'construction'
  | 'cleaning'
  | 'driver'
  | 'education'
  | 'accounting'
  | 'other'

export type JobType = 'fulltime' | 'parttime' | 'casual' | 'contract'

export type SalaryType = 'hourly' | 'daily' | 'monthly' | 'negotiable'

export interface JobPoster {
  id: string
  name: string
  avatar_url: string | null
  role?: string
}

export interface Job {
  id: string
  poster_id: string
  poster?: JobPoster

  listing_type: ListingType
  title: string
  company_name: string | null
  category: JobCategory
  category_other: string | null
  job_type: JobType
  description: string
  requirements: string | null
  benefits: string | null

  salary_min: number | null
  salary_max: number | null
  salary_type: SalaryType

  area: string[] | null
  city: string
  lat: number | null
  lng: number | null

  contact_name: string
  contact_phone: string
  contact_wechat: string | null

  is_active: boolean
  created_at: string
  updated_at: string
}

export interface JobFilters {
  listing_type?: ListingType
  keyword?: string
  category?: JobCategory
  job_type?: JobType
  area?: string
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/** Returns the display label for a job's category (uses custom text when category is 'other') */
export function getCategoryLabel(job: Pick<Job, 'category' | 'category_other'>): string {
  if (job.category === 'other' && job.category_other?.trim()) return job.category_other.trim()
  return JOB_CATEGORY_CONFIG[job.category].label
}

export const JOB_CATEGORY_CONFIG: Record<JobCategory, { label: string; emoji: string }> = {
  food:         { label: '餐饮服务', emoji: '🍜' },
  retail:       { label: '零售销售', emoji: '🛍️' },
  it:           { label: 'IT技术',   emoji: '💻' },
  construction: { label: '建筑装修', emoji: '🔨' },
  cleaning:     { label: '保洁家政', emoji: '🧹' },
  driver:       { label: '司机运输', emoji: '🚗' },
  education:    { label: '教育培训', emoji: '📚' },
  accounting:   { label: '会计财务', emoji: '📊' },
  other:        { label: '其他',     emoji: '💼' },
}

export const JOB_TYPE_CONFIG: Record<JobType, { label: string; color: string }> = {
  fulltime: { label: '全职', color: 'bg-blue-100 text-blue-700' },
  parttime: { label: '兼职', color: 'bg-purple-100 text-purple-700' },
  casual:   { label: '日结', color: 'bg-orange-100 text-orange-700' },
  contract: { label: '合同', color: 'bg-teal-100 text-teal-700' },
}

export const SALARY_TYPE_LABEL: Record<SalaryType, string> = {
  hourly:     '/ 小时',
  daily:      '/ 天',
  monthly:    '/ 月',
  negotiable: '面议',
}
