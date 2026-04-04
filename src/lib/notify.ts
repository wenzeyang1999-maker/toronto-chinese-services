// ─── Notification Helper ──────────────────────────────────────────────────────
// Thin wrapper around the send-notification Edge Function.
// All calls are fire-and-forget — errors are silently logged, never thrown.
import { supabase } from './supabase'

async function notify(
  type: string,
  recipientEmail: string,
  recipientName: string,
  data: Record<string, string>
): Promise<void> {
  try {
    await supabase.functions.invoke('send-notification', {
      body: { type, recipientEmail, recipientName, data },
    })
  } catch (err) {
    console.warn('[notify] failed silently:', err)
  }
}

// ── Typed helpers ─────────────────────────────────────────────────────────────

export async function notifyNewMessage(opts: {
  recipientEmail: string
  recipientName:  string
  senderName:     string
  preview:        string
  conversationId: string
}) {
  await notify('new_message', opts.recipientEmail, opts.recipientName, {
    senderName:     opts.senderName,
    preview:        opts.preview.slice(0, 80),
    conversationId: opts.conversationId,
  })
}

export async function notifyNewFollower(opts: {
  recipientEmail: string
  recipientName:  string
  followerName:   string
  providerId:     string
}) {
  await notify('new_follower', opts.recipientEmail, opts.recipientName, {
    followerName: opts.followerName,
    providerId:   opts.providerId,
  })
}

export async function notifyNewReview(opts: {
  recipientEmail: string
  recipientName:  string
  reviewerName:   string
  serviceTitle:   string
  serviceId:      string
  rating:         string
  comment:        string
}) {
  await notify('new_review', opts.recipientEmail, opts.recipientName, {
    reviewerName:  opts.reviewerName,
    serviceTitle:  opts.serviceTitle,
    serviceId:     opts.serviceId,
    rating:        opts.rating,
    comment:       opts.comment,
  })
}

export async function notifyNewQuestion(opts: {
  recipientEmail: string
  recipientName:  string
  askerName:      string
  serviceTitle:   string
  serviceId:      string
  question:       string
}) {
  await notify('new_question', opts.recipientEmail, opts.recipientName, {
    askerName:    opts.askerName,
    serviceTitle: opts.serviceTitle,
    serviceId:    opts.serviceId,
    question:     opts.question,
  })
}
