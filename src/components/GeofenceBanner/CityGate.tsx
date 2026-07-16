// ─── CityGate — 城市围栏（B1 自动定位跳转 + B2 未开通拦截弹窗）─────────────────
// 说明书 §2.1：开屏/已授权定位后反查所在城市 → 落在开通城市则自动切换；否则弹
// 「暂未开通」轻量弹窗，引导手动选城（B3 CityPicker）或帮亲友发单。替代旧的
// GeofenceBanner（那只是被动提示，不做城市切换）。
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, X, Globe2 } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useCityStore } from '../../store/cityStore'
import { nearestOpenedCity } from '../../data/cities'
import CityPicker from '../CityPicker/CityPicker'

const SESSION_KEY = 'tcs_city_gate_dismissed'

export default function CityGate() {
  const userLocation = useAppStore((s) => s.userLocation)
  const setCity = useCityStore((s) => s.setCity)
  const pinned  = useCityStore((s) => s.pinned)
  const [showPopup, setShowPopup]   = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (!userLocation) return
    const opened = nearestOpenedCity(userLocation.lat, userLocation.lng)
    if (opened) {
      // B1：落在开通城市 → 自动切到该城市（除非用户已手动固定了其它城市）
      if (!pinned) setCity(opened)
      setShowPopup(false)
    } else if (!pinned && !sessionStorage.getItem(SESSION_KEY)) {
      // B2：未开通城市 → 一次会话弹一次
      setShowPopup(true)
    }
  }, [userLocation, pinned, setCity])

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, '1')
    setShowPopup(false)
  }

  return (
    <>
      <AnimatePresence>
        {showPopup && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={dismiss} className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]" />
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61]
                         w-[calc(100%-2.5rem)] max-w-sm bg-white rounded-3xl shadow-2xl p-5"
            >
              <button onClick={dismiss} className="absolute top-3 right-3 text-gray-300 hover:text-gray-500"><X size={18} /></button>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
                <MapPin size={24} className="text-amber-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900">当前城市暂未开通服务</h3>
              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                华邻正在全速解锁中！你可以手动选择已开通城市（如多伦多）体验服务，或帮亲友发单。
              </p>
              <div className="flex flex-col gap-2 mt-4">
                <button onClick={() => { setPickerOpen(true); dismiss() }}
                  className="w-full py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 flex items-center justify-center gap-1.5">
                  <Globe2 size={15} /> 手动选择城市
                </button>
                <button onClick={dismiss}
                  className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50">
                  先看看
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <CityPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </>
  )
}
