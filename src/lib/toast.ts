import { create } from 'zustand'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastStore {
  items: ToastItem[]
  add: (message: string, type: ToastType) => void
  remove: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  items: [],
  add: (message, type) => {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    set(s => ({ items: [...s.items, { id, message, type }] }))
    setTimeout(() => set(s => ({ items: s.items.filter(t => t.id !== id) })), 3500)
  },
  remove: (id) => set(s => ({ items: s.items.filter(t => t.id !== id) })),
}))

export function toast(message: string, type: ToastType = 'info') {
  useToastStore.getState().add(message, type)
}
