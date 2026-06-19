import { useState } from 'react'
import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Job } from '../../Jobs/types'
import { JOB_CATEGORY_CONFIG, JOB_TYPE_CONFIG, SALARY_TYPE_LABEL, getCategoryLabel } from '../../Jobs/types'

interface Props {
  jobs: Job[]
}

export default function JobsSection({ jobs }: Props) {
  const navigate = useNavigate()
  const [jobTab, setJobTab] = useState<'hiring' | 'seeking'>('hiring')

  const hasBoth = jobs.some(j => j.listing_type === 'hiring') && jobs.some(j => j.listing_type === 'seeking')
  const filtered = hasBoth ? jobs.filter(j => j.listing_type === jobTab) : jobs

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 mb-3 px-1">
        发布的职位（{jobs.length}）
      </h2>

      {hasBoth && (
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1 mb-3">
          {(['hiring', 'seeking'] as const).map(t => (
            <button key={t} onClick={() => setJobTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                jobTab === t ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'hiring' ? '💼 招聘' : '🙋 求职'}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((job, i) => {
          const salaryLabel = job.salary_type === 'negotiable'
            ? '薪资面议'
            : job.salary_min && job.salary_max
              ? `$${job.salary_min}–$${job.salary_max}${SALARY_TYPE_LABEL[job.salary_type]}`
              : job.salary_min ? `$${job.salary_min} 起${SALARY_TYPE_LABEL[job.salary_type]}` : '薪资面议'

          return (
            <motion.div key={job.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/jobs/${job.id}`)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer
                         hover:border-primary-200 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-semibold text-gray-900 text-sm leading-snug flex-1">{job.title}</h3>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${JOB_TYPE_CONFIG[job.job_type].color}`}>
                  {JOB_TYPE_CONFIG[job.job_type].label}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {JOB_CATEGORY_CONFIG[job.category].emoji} {getCategoryLabel(job)}
                </span>
                <span className="text-sm font-bold text-primary-600">{salaryLabel}</span>
                {job.area && job.area.length > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] text-gray-500">
                    <MapPin size={10} />{job.area.join('·')}
                  </span>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
