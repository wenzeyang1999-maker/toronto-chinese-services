// ─── Jobs Store (Zustand) ─────────────────────────────────────────────────────
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Job, JobFilters } from '../pages/Jobs/types'

// Shape of a raw row returned from Supabase (jobs + joined users)
interface JobRow {
  id: string
  poster_id: string
  poster: { id: string; name: string; avatar_url: string | null; role?: string } | null
  listing_type: string
  title: string
  company_name: string | null
  category_other: string | null
  category: string
  job_type: string
  description: string
  requirements: string | null
  benefits: string | null
  salary_min: number | null
  salary_max: number | null
  salary_type: string
  area: string[] | null
  city: string | null
  lat: number | null
  lng: number | null
  contact_name: string
  contact_phone: string
  contact_wechat: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

function mapRow(row: JobRow): Job {
  return {
    id:            row.id,
    poster_id:     row.poster_id,
    poster:        row.poster
      ? { id: row.poster.id, name: row.poster.name, avatar_url: row.poster.avatar_url, role: row.poster.role }
      : undefined,
    listing_type:   (row.listing_type ?? 'hiring') as Job['listing_type'],
    title:          row.title,
    category_other: row.category_other,
    company_name:  row.company_name,
    category:      row.category as Job['category'],
    job_type:      row.job_type as Job['job_type'],
    description:   row.description,
    requirements:  row.requirements,
    benefits:      row.benefits,
    salary_min:    row.salary_min,
    salary_max:    row.salary_max,
    salary_type:   row.salary_type as Job['salary_type'],
    area:          row.area,
    city:          row.city ?? 'Toronto',
    lat:           row.lat,
    lng:           row.lng,
    contact_name:  row.contact_name,
    contact_phone: row.contact_phone,
    contact_wechat: row.contact_wechat,
    is_active:     row.is_active,
    created_at:    row.created_at,
    updated_at:    row.updated_at,
  }
}

interface JobState {
  jobs: Job[]
  filters: JobFilters
  isReady: boolean

  fetchJobs: () => Promise<void>
  setFilters: (f: Partial<JobFilters>) => void
  clearFilters: () => void
  getFilteredJobs: () => Job[]
  addJob: (job: Job) => void
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs:    [],
  filters: {},
  isReady: false,

  fetchJobs: async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*, poster:users(id, name, avatar_url, role)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (!error && data) {
      set({ jobs: (data as JobRow[]).map(mapRow), isReady: true })
    } else {
      set({ isReady: true })
    }
  },

  setFilters: (f) =>
    set((state) => ({ filters: { ...state.filters, ...f } })),

  clearFilters: () => set({ filters: {} }),

  getFilteredJobs: () => {
    const { jobs, filters } = get()
    let result = jobs.filter((j) => j.is_active)

    if (filters.listing_type) {
      result = result.filter((j) => j.listing_type === filters.listing_type)
    }
    if (filters.category) {
      result = result.filter((j) => j.category === filters.category)
    }
    if (filters.job_type) {
      result = result.filter((j) => j.job_type === filters.job_type)
    }
    if (filters.area) {
      result = result.filter((j) => j.area?.includes(filters.area!))
    }
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase()
      result = result.filter(
        (j) =>
          j.title.toLowerCase().includes(kw) ||
          j.description.toLowerCase().includes(kw) ||
          (j.company_name ?? '').toLowerCase().includes(kw)
      )
    }

    return result
  },

  addJob: (job) =>
    set((state) => ({ jobs: [job, ...state.jobs] })),
}))
