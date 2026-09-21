// ─── 后台错误告警助手 ─────────────────────────────────────────────────────────
// 在关键 edge function 的错误分支调用:记录 error_events + 节流(同类 60min 一次)
// 给 admin/boss 发站内信 + 邮件。best-effort,自身失败绝不影响主流程。
//   await reportError('moderate-content', 'groq_vision_404', '模型下线')
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
}

export async function reportError(source: string, code: string, message = ''): Promise<void> {
  try {
    const url        = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) return
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    const { data } = await admin.rpc('report_error', { p_source: source, p_code: code, p_message: message })
    // 节流命中或无管理员 → 只记录了日志,不再发信
    if (!data?.notified || !Array.isArray(data.admins) || data.admins.length === 0) return

    const apiKey = Deno.env.get('BREVO_API_KEY')
    if (!apiKey) return
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'HuaLin 后台告警', email: 'noreply@hualinlife.com' },
        to: data.admins.map((a: { email: string }) => ({ email: a.email })),
        subject: `⚠️ 华邻后台告警:${source} / ${code}`,
        htmlContent:
          `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
             <h3 style="color:#dc2626">后台错误告警</h3>
             <p><b>来源:</b> ${esc(source)}</p>
             <p><b>错误码:</b> ${esc(code)}</p>
             <p><b>详情:</b> ${esc(message).slice(0, 600)}</p>
             <p><b>时间:</b> ${new Date().toISOString()}</p>
             <p style="color:#6b7280;font-size:13px">同类错误 60 分钟内只发一次。请到后台 /dashboard 查看。</p>
           </div>`,
      }),
    })
  } catch (_e) {
    // 告警链路自身出错时静默:绝不能反过来影响主功能
  }
}
