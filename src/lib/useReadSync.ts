// Syncs read state from Supabase into readStore when a user logs in.
// Runs once per auth state change; merges remote keys with local localStorage.
import { useEffect } from 'react'
import { supabase } from './supabase'
import { useReadStore } from '../store/readStore'

export function useReadSync() {
  const hydrate = useReadStore((s) => s.hydrate)

  useEffect(() => {
    async function sync(userId: string) {
      const { data } = await supabase
        .from('user_read_posts')
        .select('type, post_id')
        .eq('user_id', userId)
      if (!data) return
      const keys = data.map((r: { type: string; post_id: string }) => `${r.type}:${r.post_id}`)
      hydrate(keys)
    }

    // Sync immediately if already logged in
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) sync(data.session.user.id)
    })

    // Sync on future login events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) sync(session.user.id)
    })

    return () => subscription.unsubscribe()
  }, [hydrate])
}
