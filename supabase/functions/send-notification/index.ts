// ─── send-notification Edge Function ─────────────────────────────────────────
// Sends transactional email notifications via Resend API.
// Called directly from the frontend after key events.
//
// POST body:
//   type: 'new_message' | 'new_follower' | 'new_review' | 'new_question'
//   recipientEmail: string
//   recipientName:  string
//   data:           object  (event-specific fields)

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FROM = 'Toronto-Chinese-Service <noreply@huarenq.com>'
const SITE = 'https://toronto-chinese-services.vercel.app'

// ── Email templates ───────────────────────────────────────────────────────────

function template(title: string, body: string, ctaText: string, ctaUrl: string): string {
  return `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body { margin:0; padding:0; background:#f5f5f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  .wrap { max-width:520px; margin:32px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
  .header { background:linear-gradient(135deg,#e63946,#c1121f); padding:28px 32px; }
  .header h1 { margin:0; color:#fff; font-size:20px; font-weight:700; }
  .header p  { margin:4px 0 0; color:rgba(255,255,255,0.8); font-size:13px; }
  .body   { padding:28px 32px; }
  .body p { margin:0 0 16px; color:#374151; font-size:15px; line-height:1.6; }
  .cta    { display:inline-block; margin-top:8px; background:#e63946; color:#fff !important;
            text-decoration:none; padding:12px 28px; border-radius:10px; font-weight:700; font-size:14px; }
  .footer { padding:20px 32px; border-top:1px solid #f0f0f0; }
  .footer p { margin:0; color:#9ca3af; font-size:12px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>大多伦多华人服务</h1>
    <p>Toronto Chinese Services</p>
  </div>
  <div class="body">
    <p style="font-size:17px;font-weight:700;color:#111827;margin-bottom:20px;">${title}</p>
    ${body}
    <a href="${ctaUrl}" class="cta">${ctaText}</a>
  </div>
  <div class="footer">
    <p>您收到此邮件是因为您在 <a href="${SITE}" style="color:#e63946;">huarenq.com</a> 上有新的动态。</p>
  </div>
</div>
</body>
</html>`
}

function buildEmail(type: string, recipientName: string, data: Record<string, string>) {
  switch (type) {

    case 'new_message':
      return {
        subject: `💬 ${data.senderName} 给您发了一条消息`,
        html: template(
          `您收到一条新消息`,
          `<p>您好 <strong>${recipientName}</strong>，</p>
           <p><strong>${data.senderName}</strong> 通过平台给您发送了一条消息：</p>
           <p style="background:#f9fafb;border-left:3px solid #e63946;padding:12px 16px;border-radius:0 8px 8px 0;color:#374151;">
             "${data.preview}"
           </p>
           <p>请及时回复，提高您的回复率有助于获得更多客户。</p>`,
          '查看消息',
          `${SITE}/conversation/${data.conversationId}`
        ),
      }

    case 'new_follower':
      return {
        subject: `🎉 ${data.followerName} 关注了您`,
        html: template(
          `您有新粉丝了！`,
          `<p>您好 <strong>${recipientName}</strong>，</p>
           <p><strong>${data.followerName}</strong> 刚刚关注了您的主页。</p>
           <p>继续保持高质量的服务，您的粉丝会越来越多！</p>`,
          '查看我的主页',
          `${SITE}/provider/${data.providerId}`
        ),
      }

    case 'new_review':
      return {
        subject: `⭐ 您收到了一条新评价（${data.rating} 星）`,
        html: template(
          `您收到了新评价`,
          `<p>您好 <strong>${recipientName}</strong>，</p>
           <p><strong>${data.reviewerName}</strong> 为您的服务「${data.serviceTitle}」留下了 <strong>${data.rating} 星</strong>评价：</p>
           ${data.comment
             ? `<p style="background:#f9fafb;border-left:3px solid #fbbf24;padding:12px 16px;border-radius:0 8px 8px 0;color:#374151;">"${data.comment}"</p>`
             : `<p style="color:#9ca3af;font-size:13px;">（无文字评价）</p>`
           }
           <p>您可以在服务详情页回复这条评价。</p>`,
          '查看评价',
          `${SITE}/service/${data.serviceId}`
        ),
      }

    case 'new_question':
      return {
        subject: `❓ 有人在您的服务下提问了`,
        html: template(
          `您的服务收到了新问题`,
          `<p>您好 <strong>${recipientName}</strong>，</p>
           <p><strong>${data.askerName}</strong> 在您的服务「${data.serviceTitle}」下提了一个公开问题：</p>
           <p style="background:#f9fafb;border-left:3px solid #6366f1;padding:12px 16px;border-radius:0 8px 8px 0;color:#374151;">
             "${data.question}"
           </p>
           <p>及时回答问题可以提升您的服务转化率。</p>`,
          '去回答问题',
          `${SITE}/service/${data.serviceId}`
        ),
      }

    case 'provider_inquiry':
      return {
        subject: `🔔 有客户正在寻找「${data.categoryLabel}」服务`,
        html: template(
          `您有一条新的客户询价`,
          `<p>您好 <strong>${recipientName}</strong>，</p>
           <p>有客户通过平台发布了一条服务需求，与您提供的「<strong>${data.categoryLabel}</strong>」服务匹配，请及时联系客户：</p>
           <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
             <tr style="background:#f9fafb;">
               <td style="padding:10px 14px;color:#6b7280;width:90px;font-weight:600;">客户姓名</td>
               <td style="padding:10px 14px;color:#111827;">${data.customerName}</td>
             </tr>
             <tr>
               <td style="padding:10px 14px;color:#6b7280;font-weight:600;">联系电话</td>
               <td style="padding:10px 14px;color:#111827;font-weight:700;">${data.phone}</td>
             </tr>
             <tr style="background:#f9fafb;">
               <td style="padding:10px 14px;color:#6b7280;font-weight:600;">微信号</td>
               <td style="padding:10px 14px;color:#111827;">${data.wechat}</td>
             </tr>
             <tr>
               <td style="padding:10px 14px;color:#6b7280;font-weight:600;">服务类型</td>
               <td style="padding:10px 14px;color:#111827;">${data.categoryLabel}</td>
             </tr>
             <tr style="background:#f9fafb;">
               <td style="padding:10px 14px;color:#6b7280;font-weight:600;">需求描述</td>
               <td style="padding:10px 14px;color:#374151;">${data.description}</td>
             </tr>
             <tr>
               <td style="padding:10px 14px;color:#6b7280;font-weight:600;">预算</td>
               <td style="padding:10px 14px;color:#111827;">$${data.budget}</td>
             </tr>
             <tr style="background:#f9fafb;">
               <td style="padding:10px 14px;color:#6b7280;font-weight:600;">希望时间</td>
               <td style="padding:10px 14px;color:#111827;">${data.timing}</td>
             </tr>
           </table>
           <p style="color:#6b7280;font-size:13px;">⚡ 建议尽快联系客户，先到先得！同类服务商也可能收到此通知。</p>`,
          '登录平台查看更多询价',
          SITE
        ),
      }

    case 'welcome':
      return {
        subject: `🎉 欢迎加入大多伦多华人服务平台！`,
        html: template(
          `欢迎加入华人圈！`,
          `<p>您好 <strong>${recipientName}</strong>，</p>
           <p>感谢您注册<strong>大多伦多华人服务平台</strong>！</p>
           <p>您现在可以：</p>
           <ul style="color:#374151;font-size:14px;line-height:2;">
             <li>🔧 浏览和联系本地华人服务商</li>
             <li>💼 查找招聘信息或发布求职帖</li>
             <li>🏘️ 在社区圈子分享生活经验</li>
             <li>🛒 发布或购买二手好物</li>
           </ul>
           <p>如有任何问题，欢迎随时联系我们。</p>`,
          '开始探索',
          SITE
        ),
      }

    default:
      return null
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { type, recipientEmail, recipientName, data } = await req.json()

    if (!type || !recipientEmail) {
      return new Response(JSON.stringify({ error: 'missing fields' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const email = buildEmail(type, recipientName ?? '用户', data ?? {})
    if (!email) {
      return new Response(JSON.stringify({ error: 'unknown type' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) throw new Error('RESEND_API_KEY not set')

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    FROM,
        to:      [recipientEmail],
        subject: email.subject,
        html:    email.html,
      }),
    })

    const result = await res.json()
    if (!res.ok) throw new Error(result.message ?? 'Resend error')

    return new Response(JSON.stringify({ ok: true, id: result.id }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-notification error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
