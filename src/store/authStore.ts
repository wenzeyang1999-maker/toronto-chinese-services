// ─── Auth Store (Zustand) ─────────────────────────────────────────────────────
// Holds the current Supabase session and user.
// Updated in App.tsx via supabase.auth.onAuthStateChange.
import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))
