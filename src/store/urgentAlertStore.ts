// ─── Urgent Alert Store ───────────────────────────────────────────────────────
// Holds the current in-app「紧急单」popup for an online provider. When a matching
// urgent request lands over Realtime (useUrgentRequestAlerts), the alert is set
// here and <UrgentLeadPopup /> renders it. Cleared when the provider views or
// dismisses it.
import { create } from 'zustand'

export interface UrgentAlert {
  id:       string          // service_requests.id
  title:    string
  category: string
  area:     string | null
  isUrgent: boolean         // true=紧急单(红/强提醒) false=普通需求(蓝/温和)
  posterId: string          // service_requests.user_id — 客户,用于「接单」直接开聊
}

interface UrgentAlertState {
  alert: UrgentAlert | null
  setAlert: (a: UrgentAlert) => void
  clear: () => void
}

export const useUrgentAlertStore = create<UrgentAlertState>((set) => ({
  alert: null,
  setAlert: (alert) => set({ alert }),
  clear: () => set({ alert: null }),
}))
