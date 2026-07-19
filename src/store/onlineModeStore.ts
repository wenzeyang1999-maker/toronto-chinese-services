// ─── Online-Mode Store ────────────────────────────────────────────────────────
// Tracks whether the current user is in「上线接单」(provider/online) mode. When
// true, the whole app renders a faint bottom-to-top blue tint (see App.tsx) so a
// provider always knows at a glance they're live on the map. Kept in a global
// store — not just Profile-local state — because the tint spans every screen.
import { create } from 'zustand'

const LS_KEY = 'tcs_online_mode'

function readInitial(): boolean {
  try { return localStorage.getItem(LS_KEY) === 'true' } catch { return false }
}

interface OnlineModeState {
  online: boolean
  setOnline: (v: boolean) => void
}

export const useOnlineModeStore = create<OnlineModeState>((set) => ({
  online: readInitial(),
  setOnline: (v) => {
    try { localStorage.setItem(LS_KEY, v ? 'true' : 'false') } catch { /* ignore */ }
    set({ online: v })
  },
}))
