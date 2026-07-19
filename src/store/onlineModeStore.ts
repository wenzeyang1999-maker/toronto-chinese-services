// ─── Online-Mode Store ────────────────────────────────────────────────────────
// Tracks whether the current user is in「上线接单」(provider/online) mode. When
// true, the whole app renders a faint bottom-to-top blue tint (see App.tsx) so a
// provider always knows at a glance they're live on the map.
//
// Single source of truth = `tcs_profile_mode` (the same localStorage key that
// drives the「一键翻转」identity card). Keeping the tint on the SAME signal as the
// card avoids the two drifting apart (card says online, tint doesn't show).
import { create } from 'zustand'

function readInitial(): boolean {
  try { return localStorage.getItem('tcs_profile_mode') === 'provider' } catch { return false }
}

interface OnlineModeState {
  online: boolean
  setOnline: (v: boolean) => void
}

export const useOnlineModeStore = create<OnlineModeState>((set) => ({
  online: readInitial(),
  // In-memory mirror only — persistence is owned by `tcs_profile_mode` (written
  // by Profile's switchMode), so we don't write a second key here.
  setOnline: (v) => set({ online: v }),
}))
