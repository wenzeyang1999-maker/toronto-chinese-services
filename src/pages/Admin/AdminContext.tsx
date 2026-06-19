// ─── Admin shared context ────────────────────────────────────────────────────
// Transports the cross-cutting helpers (notice banner, action wrapper, the
// global "acting" lock, and a stats refresher) from AdminPage down to each tab
// component, so tabs don't need to prop-drill them individually.
import { createContext, useContext } from 'react'
import type { AdminNotice, DeleteTarget } from './types'

export interface AdminCtx {
  /** id of the row currently being acted on (disables its buttons), or null */
  acting: string | null
  setActing: (v: string | null) => void
  /** Show a transient success/error banner at the top of the admin page. */
  showNotice: (type: AdminNotice['type'], text: string) => void
  /** Run an async admin action, showing success/error notices automatically.
   *  Returns the action's result, or null if it threw. */
  runAdminAction: <T>(action: () => Promise<T>, successText: string) => Promise<T | null>
  /** Reload the top-level stats counters (after an action changes them). */
  refreshStats: () => Promise<void>
  /** Open the shared delete-user confirmation modal (pass null to close). */
  setDeleteTarget: (t: DeleteTarget | null) => void
}

const AdminContext = createContext<AdminCtx | null>(null)

export function useAdminContext(): AdminCtx {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdminContext must be used within <AdminContext.Provider>')
  return ctx
}

export default AdminContext
