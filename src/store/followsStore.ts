// ─── Follows Store ────────────────────────────────────────────────────────────
// Tracks which providers the current user follows.
// Uses a Set<providerId> for O(1) lookup.
// Supports optimistic toggle (UI updates instantly before DB confirms).
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { notifyNewFollower } from '../lib/notify'

interface FollowsState {
  following:  Set<string>   // provider IDs the current user follows
  isReady:    boolean
  fetchFollows:  (userId: string) => Promise<void>
  isFollowing:   (providerId: string) => boolean
  toggleFollow:  (userId: string, providerId: string) => Promise<void>
  clearFollows:  () => void
}

export const useFollowsStore = create<FollowsState>((set, get) => ({
  following: new Set(),
  isReady:   false,

  async fetchFollows(userId) {
    const { data } = await supabase
      .from('follows')
      .select('provider_id')
      .eq('follower_id', userId)
    set({
      following: new Set((data ?? []).map((r: any) => r.provider_id)),
      isReady: true,
    })
  },

  isFollowing(providerId) {
    return get().following.has(providerId)
  },

  async toggleFollow(userId, providerId) {
    const already = get().isFollowing(providerId)

    // Optimistic update
    set(s => {
      const next = new Set(s.following)
      if (already) next.delete(providerId)
      else         next.add(providerId)
      return { following: next }
    })

    if (already) {
      const { error } = await supabase.from('follows')
        .delete()
        .eq('follower_id', userId)
        .eq('provider_id', providerId)
      if (error) {
        set(s => { const next = new Set(s.following); next.add(providerId); return { following: next } })
      }
    } else {
      const { error } = await supabase.from('follows')
        .insert({ follower_id: userId, provider_id: providerId })
      if (error) {
        set(s => { const next = new Set(s.following); next.delete(providerId); return { following: next } })
        return
      }

      // Notify provider — fetch both users' info in parallel
      const [followerRes, providerRes] = await Promise.all([
        supabase.from('users').select('name').eq('id', userId).single(),
        supabase.from('users').select('email, name').eq('id', providerId).single(),
      ])
      if (providerRes.data?.email) {
        notifyNewFollower({
          recipientEmail: providerRes.data.email,
          recipientName:  providerRes.data.name ?? '用户',
          followerName:   followerRes.data?.name ?? '用户',
          providerId,
        })
      }
    }
  },

  clearFollows() {
    set({ following: new Set(), isReady: false })
  },
}))
