import { Search, Sparkles, PenSquare } from 'lucide-react'

interface Props {
  query: string
  onOpenInquiry: () => void
  onPost: () => void
}

export default function SearchEmptyState({ query, onOpenInquiry, onPost }: Props) {
  return (
    <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center shadow-sm">
      <Search size={40} className="mx-auto mb-3 text-gray-300" />
      <h3 className="text-lg font-semibold text-gray-800">
        {query ? `还没找到“${query}”相关服务` : '暂时没有符合条件的服务'}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
        你可以换个关键词继续找，也可以把需求交给平台帮你匹配，避免自己一条条筛。
      </p>

      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        <button
          onClick={onOpenInquiry}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Sparkles size={16} />
          让 AI 帮你找
        </button>
        <button
          onClick={onPost}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <PenSquare size={16} />
          发布需求
        </button>
      </div>
    </div>
  )
}
