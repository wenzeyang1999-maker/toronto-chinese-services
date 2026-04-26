// ─── Notification Helper ──────────────────────────────────────────────────────
// Thin wrapper around the send-notification Edge Function.
// All calls are fire-and-forget — errors are silently logged, never thrown.
import { supabase } from './supabase'

async function notify(
  type: string,
  recipientUserId: string,
  data: Record<string, string>
): Promise<void> {
  try {
    await supabase.functions.invoke('send-notification', {
      body: { type, recipientUserId, data },
    })
  } catch (err) {
    console.warn('[notify] failed silently:', err)
  }
}

async function sendWebPush(opts: {
  recipientUserId: string
  title:           string
  body:            string
  url?:            string
  tag?:            string
}): Promise<void> {
  try {
    await supabase.functions.invoke('send-web-push', { body: opts })
  } catch (err) {
    console.warn('[push] failed silently:', err)
  }
}

// ── Typed helpers ─────────────────────────────────────────────────────────────

export async function notifyNewMessage(opts: {
  recipientUserId: string
  senderName:     string
  preview:        string
  conversationId: string
}) {
  // Send email + push in parallel (both are best-effort)
  await Promise.allSettled([
    notify('new_message', opts.recipientUserId, {
      senderName:     opts.senderName,
      preview:        opts.preview.slice(0, 80),
      conversationId: opts.conversationId,
    }),
    sendWebPush({
      recipientUserId: opts.recipientUserId,
      title: `${opts.senderName} 给你发了消息`,
      body:  opts.preview.slice(0, 120),
      url:   `/conversation/${opts.conversationId}`,
      tag:   `msg-${opts.conversationId}`,
    }),
  ])
}

export async function notifyNewFollower(opts: {
  recipientUserId: string
  followerName:   string
  providerId:     string
}) {
  await notify('new_follower', opts.recipientUserId, {
    followerName: opts.followerName,
    providerId:   opts.providerId,
  })
}

export async function notifyNewReview(opts: {
  recipientUserId: string
  reviewerName:   string
  serviceTitle:   string
  serviceId:      string
  rating:         string
  comment:        string
}) {
  await notify('new_review', opts.recipientUserId, {
    reviewerName:  opts.reviewerName,
    serviceTitle:  opts.serviceTitle,
    serviceId:     opts.serviceId,
    rating:        opts.rating,
    comment:       opts.comment,
  })
}

export async function notifyProviderInquiry(opts: {
  recipientUserId: string
  customerName:   string
  phone:          string
  wechat:         string
  categoryLabel:  string
  description:    string
  budget:         string
  timing:         string
}) {
  await notify('provider_inquiry', opts.recipientUserId, {
    customerName:  opts.customerName,
    phone:         opts.phone,
    wechat:        opts.wechat,
    categoryLabel: opts.categoryLabel,
    description:   opts.description,
    budget:        opts.budget,
    timing:        opts.timing,
  })
}

export async function notifyNewQuestion(opts: {
  recipientUserId: string
  askerName:      string
  serviceTitle:   string
  serviceId:      string
  question:       string
}) {
  await notify('new_question', opts.recipientUserId, {
    askerName:    opts.askerName,
    serviceTitle: opts.serviceTitle,
    serviceId:    opts.serviceId,
    question:     opts.question,
  })
}

export async function notifyFollowerNewService(opts: {
  recipientUserId: string
  providerName: string
  serviceTitle: string
  serviceId: string
}) {
  await notify('new_service_post', opts.recipientUserId, {
    providerName: opts.providerName,
    serviceTitle: opts.serviceTitle,
    serviceId: opts.serviceId,
  })
}

export async function notifyAdminPromoRequest(opts: {
  serviceName:   string
  serviceId:     string
  providerName:  string
  providerEmail: string
  note:          string
}) {
  try {
    await supabase.functions.invoke('send-notification', {
      body: {
        type: 'admin_promo_request',
        recipientRole: 'admin',
        data: {
          serviceName:   opts.serviceName,
          serviceId:     opts.serviceId,
          providerName:  opts.providerName,
          providerEmail: opts.providerEmail,
          note:          opts.note,
        },
      },
    })
  } catch (err) {
    console.warn('[notify] promo request failed silently:', err)
  }
}

export async function notifyAdminCommunityReport(opts: {
  reportType: 'post' | 'comment'
  reasonLabel: string
  postId: string
  postTitle: string
  commentPreview?: string
  reporterName: string
}) {
  try {
    await supabase.functions.invoke('send-notification', {
      body: {
        type: 'admin_community_report',
        recipientRole: 'admin',
        data: {
          reportType: opts.reportType,
          reasonLabel: opts.reasonLabel,
          postId: opts.postId,
          postTitle: opts.postTitle,
          commentPreview: opts.commentPreview ?? '',
          reporterName: opts.reporterName,
        },
      },
    })
  } catch (err) {
    console.warn('[notify] failed silently:', err)
  }
}
