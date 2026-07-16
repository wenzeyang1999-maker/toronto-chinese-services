// ─── CityPicker — 三级地区联动选择（大洲 → 国家 → 城市）B3 ────────────────────
// 说明书 §2.2：手动选择区域层级，支持跨城帮亲友发单。仅「开通」城市可选，其余
// 显示「即将开通」。选定后写 cityStore（pinned，不再被自动定位覆盖）。
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, ChevronRight } from 'lucide-react'
import { REGION_TREE, type City } from '../../data/cities'
import { useCityStore } from '../../store/cityStore'

interface Props {
  open: boolean
  onClose: () => void
}

export default function CityPicker({ open, onClose }: Props) {
  const city = useCityStore((s) => s.city)
  const setCity = useCityStore((s) => s.setCity)
  const [continentId, setContinentId] = useState(REGION_TREE[0].id)
  const [countryId, setCountryId] = useState(REGION_TREE[0].countries[0].id)

  const continent = REGION_TREE.find(c => c.id === continentId) ?? REGION_TREE[0]
  const country = continent.countries.find(c => c.id === countryId) ?? continent.countries[0]

  function pick(c: City) {
    if (!c.opened) return
    setCity(c, { pinned: true })
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[71]
                       w-[calc(100%-2rem)] max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">选择城市</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">当前：{city.name}</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="flex h-[min(60vh,420px)]">
              {/* 大洲 */}
              <div className="w-24 flex-shrink-0 bg-gray-50 overflow-y-auto">
                {REGION_TREE.map((ct) => (
                  <button key={ct.id}
                    onClick={() => { setContinentId(ct.id); setCountryId(ct.countries[0].id) }}
                    className={`w-full text-left px-3 py-3 text-sm transition-colors ${
                      ct.id === continentId ? 'bg-white font-semibold text-primary-700' : 'text-gray-500 hover:bg-gray-100'}`}>
                    {ct.name}
                  </button>
                ))}
              </div>
              {/* 国家 */}
              <div className="w-28 flex-shrink-0 border-x border-gray-100 overflow-y-auto">
                {continent.countries.map((co) => (
                  <button key={co.id}
                    onClick={() => setCountryId(co.id)}
                    className={`w-full text-left px-3 py-3 text-sm flex items-center justify-between transition-colors ${
                      co.id === countryId ? 'bg-primary-50 font-semibold text-primary-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                    {co.name}
                    {co.id === countryId && <ChevronRight size={14} className="text-primary-400" />}
                  </button>
                ))}
              </div>
              {/* 城市 */}
              <div className="flex-1 overflow-y-auto">
                {country.cities.map((c) => (
                  <button key={c.id} onClick={() => pick(c)} disabled={!c.opened}
                    className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between transition-colors ${
                      c.opened ? 'text-gray-800 hover:bg-primary-50' : 'text-gray-300 cursor-not-allowed'}`}>
                    <span className="flex items-center gap-2">
                      {c.name}
                      {!c.opened && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">即将开通</span>}
                    </span>
                    {city.id === c.id && <Check size={16} className="text-primary-600" />}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
