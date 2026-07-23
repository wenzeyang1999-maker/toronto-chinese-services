// 精简版：一行文字说明当前搜索结果，不再用占版面的大卡片 + 提示芯片。
interface Props {
  query: string
  count: number
  sortBy: 'distance' | 'rating' | 'newest' | 'price'
}

const SORT_LABEL: Record<Props['sortBy'], string> = {
  distance: '距离优先',
  rating: '口碑优先',
  newest: '最新发布',
  price: '价格优先',
}

export default function SearchDecisionHeader({ query, count, sortBy }: Props) {
  return (
    <p className="mb-3 text-sm text-gray-600">
      <span className="font-semibold text-gray-900">
        {query ? `“${query}” 相关服务` : '本地服务'}
      </span>
      <span className="text-gray-400"> · 共 {count} 条 · 按{SORT_LABEL[sortBy]}</span>
    </p>
  )
}
