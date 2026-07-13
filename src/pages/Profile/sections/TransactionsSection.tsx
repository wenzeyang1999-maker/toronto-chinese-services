// ─── 我的交易 ───────────────────────────────────────────────────────────────
// Merges the three transaction views (我发的需求 / 我接的单 / 成交订单) into one
// tabbed page. Tabs are mode-aware: the buyer view shows 我发的需求 + 成交订单,
// the seller view shows 我接的单 + 成交订单. Deep links (?section=orders etc.)
// pass initialTab so an incoming notification lands on the right tab.
import { useState } from 'react'
import InquiriesSection        from './InquiriesSection'
import ClaimedInquiriesSection from './ClaimedInquiriesSection'
import OrdersSection           from './OrdersSection'

export type TxnTab = 'inquiries' | 'claimed' | 'orders'

const CLIENT_TABS: { key: TxnTab; label: string }[] = [
  { key: 'inquiries', label: '我发的需求' },
  { key: 'orders',    label: '成交订单' },
]
const PROVIDER_TABS: { key: TxnTab; label: string }[] = [
  { key: 'claimed', label: '我接的单' },
  { key: 'orders',  label: '成交订单' },
]

interface Props {
  mode: 'client' | 'provider'
  initialTab?: TxnTab
}

export default function TransactionsSection({ mode, initialTab }: Props) {
  const tabs = mode === 'provider' ? PROVIDER_TABS : CLIENT_TABS
  const start = initialTab && tabs.some(t => t.key === initialTab) ? initialTab : tabs[0].key
  const [tab, setTab] = useState<TxnTab>(start)

  return (
    <div className="flex-1 w-full">
      {/* Tab bar */}
      <div className="sticky top-14 z-10 bg-gray-50 border-b border-gray-200 px-4">
        <div className="max-w-md lg:max-w-none mx-auto flex gap-1 py-2">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                tab === t.key ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'inquiries' && <InquiriesSection />}
      {tab === 'claimed'   && <ClaimedInquiriesSection />}
      {tab === 'orders'    && <OrdersSection />}
    </div>
  )
}
