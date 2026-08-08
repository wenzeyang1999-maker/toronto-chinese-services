// ─── 首页地图预览卡(内测#5) ──────────────────────────────────────────────────
// 首页不再内嵌整张交互地图(改由独立页 /map 华邻地图承担,#7)。这里只放一张
// 轻量预览卡(纯 CSS 底图,无 Google Maps 瓦片/API 成本),点击直达华邻地图。
import { MapPin, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface Props {
  to: string                 // 目标(如 /map 或 /map?type=requests)
  count?: number
  label?: string
}

export default function MapPreviewCard({ to, count, label = '在华邻地图查看附近分布' }: Props) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(to)}
      className="relative block w-full h-56 md:h-64 overflow-hidden rounded-2xl border border-gray-200 shadow-sm group"
    >
      {/* 纯 CSS 地图底图 */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-sky-50 to-indigo-50" />
      <div className="absolute inset-0 opacity-[0.18]"
        style={{ backgroundImage: 'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      <div className="absolute -inset-8 opacity-[0.12]"
        style={{ backgroundImage: 'linear-gradient(115deg, transparent 46%, #38bdf8 46%, #38bdf8 52%, transparent 52%)' }} />
      <MapPin size={18} className="absolute text-rose-500 fill-rose-200"     style={{ top: '22%', left: '24%' }} />
      <MapPin size={16} className="absolute text-amber-500 fill-amber-200"   style={{ top: '56%', left: '20%' }} />
      <MapPin size={17} className="absolute text-violet-500 fill-violet-200" style={{ top: '30%', right: '24%' }} />
      <MapPin size={15} className="absolute text-emerald-500 fill-emerald-200" style={{ bottom: '22%', right: '30%' }} />
      {/* 真·地图截图:放 public/map-snapshot.jpg 即自动启用;缺失则隐藏回退 CSS 底图 */}
      <img src="/map-snapshot.jpg" alt="" aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
      <div className="absolute inset-0 bg-gradient-to-t from-white/85 via-white/20 to-transparent" />
      {/* 中央 CTA */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-transform group-hover:scale-105">
          <MapPin size={22} />
        </div>
        <p className="text-sm font-bold text-gray-800">{label}</p>
        <p className="inline-flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-primary-600 shadow-sm">
          {count && count > 0 ? `${count} 项 · ` : ''}点击打开华邻地图 <ArrowRight size={12} />
        </p>
      </div>
    </button>
  )
}
