// ─── SortChips ──────────────────────────────────────────────────────────────
// Shared sort control for the marketplace lists (jobs / secondhand / realestate).
// One implementation so the 排序 UI is consistent across modules.
export type SortBy = 'newest' | 'price_low' | 'price_high'

interface Props {
  value: SortBy
  onChange: (s: SortBy) => void
  priceLabel?: string   // '价格' (default) or '薪资' for jobs
}

export default function SortChips({ value, onChange, priceLabel = '价格' }: Props) {
  const opts: { v: SortBy; l: string }[] = [
    { v: 'newest',     l: '最新' },
    { v: 'price_low',  l: `${priceLabel}低到高` },
    { v: 'price_high', l: `${priceLabel}高到低` },
  ]
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
      {opts.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all
            ${value === o.v
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
          {o.l}
        </button>
      ))}
    </div>
  )
}
