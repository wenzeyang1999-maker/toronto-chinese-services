import { MapPin, ShieldCheck, Star, Sparkles } from 'lucide-react'

interface Props {
  query: string
  count: number
  hasLocation: boolean
  sortBy: 'distance' | 'rating' | 'newest' | 'price'
}

const SORT_LABEL: Record<Props['sortBy'], string> = {
  distance: '距离优先',
  rating: '口碑优先',
  newest: '最新发布',
  price: '价格优先',
}

export default function SearchDecisionHeader({ query, count, hasLocation, sortBy }: Props) {
  return (
    <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-500">
            {query ? '搜索结果' : '服务浏览'}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">
            {query ? `“${query}” 相关服务` : '为你筛选本地服务'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            共找到 {count} 条结果，当前按「{SORT_LABEL[sortBy]}」查看。
          </p>
        </div>
        <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
          {count} 条
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          <ShieldCheck size={11} />
          优先看认证商家
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          <Star size={11} />
          留意评分和评价数量
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          <Sparkles size={11} />
          不确定时可直接用 AI 帮你找
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
          hasLocation
            ? 'border border-gray-200 bg-gray-50 text-gray-700'
            : 'border border-purple-200 bg-purple-50 text-purple-700'
        }`}>
          <MapPin size={11} />
          {hasLocation ? '已启用距离信息' : '地图和距离会在需要时请求位置'}
        </span>
      </div>
    </div>
  )
}
