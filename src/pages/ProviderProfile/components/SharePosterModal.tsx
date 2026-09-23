// ─── 名片海报(可发朋友圈)────────────────────────────────────────────────────
// 微信禁止「外部链接」直接分享到朋友圈(只给 发给朋友/收藏),但「图片」可以。
// 所以这里把名片渲染成一张海报图(含二维码),用户可:
//   1) 点「分享」→ 走 Web Share(files)→ 微信里选朋友圈(图片分享支持朋友圈);
//   2) 或长按图片保存 → 去微信发朋友圈。
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { X, Share2, Download, Loader2 } from 'lucide-react'
import { cdnUrl } from '../../../lib/cdnUrl'
import { toast } from '../../../lib/toast'
import type { ProviderUser } from '../types'

interface Props { provider: ProviderUser; url: string; onClose: () => void }

const BLUE = '#2563eb'
const GOLD = '#d4980f'
const INK = '#111827'
const SUB = '#6b7280'

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => res(im)
    im.onerror = () => res(null)
    im.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// 绘制海报,返回 canvas
async function drawPoster(provider: ProviderUser, qr: HTMLCanvasElement | null): Promise<HTMLCanvasElement> {
  const S = 2                     // 2x 高清
  const W = 750, H = 1120
  const canvas = document.createElement('canvas')
  canvas.width = W * S; canvas.height = H * S
  const ctx = canvas.getContext('2d')!
  ctx.scale(S, S)
  ctx.textBaseline = 'alphabetic'

  // 背景渐变
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#eef4ff'); bg.addColorStop(1, '#f7f9fc')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  // 白卡
  ctx.save()
  ctx.shadowColor = 'rgba(37,99,235,0.10)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12
  ctx.fillStyle = '#fff'; roundRect(ctx, 40, 48, W - 80, H - 150, 36); ctx.fill()
  ctx.restore()

  // 顶部品牌条
  ctx.fillStyle = BLUE; ctx.font = '700 30px system-ui, -apple-system, "PingFang SC", sans-serif'
  ctx.textAlign = 'center'; ctx.fillText('华邻 · HuaLin', W / 2, 118)
  ctx.fillStyle = SUB; ctx.font = '400 20px system-ui, "PingFang SC", sans-serif'
  ctx.fillText('本地华人生活服务', W / 2, 150)

  // 头像
  const cx = W / 2, cy = 258, R = 78
  const avatar = provider.avatar_url ? await loadImg(cdnUrl(provider.avatar_url, 220)) : null
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.closePath()
  ctx.lineWidth = 6; ctx.strokeStyle = '#e5edff'; ctx.stroke()
  ctx.clip()
  if (avatar) {
    ctx.drawImage(avatar, cx - R, cy - R, R * 2, R * 2)
  } else {
    const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R)
    g.addColorStop(0, '#60a5fa'); g.addColorStop(1, BLUE)
    ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2)
    ctx.fillStyle = '#fff'; ctx.font = '700 72px system-ui, sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(provider.name.charAt(0), cx, cy + 4)
    ctx.textBaseline = 'alphabetic'
  }
  ctx.restore()

  // 姓名
  ctx.fillStyle = INK; ctx.textAlign = 'center'
  ctx.font = '700 42px system-ui, "PingFang SC", sans-serif'
  ctx.fillText(provider.name.length > 12 ? provider.name.slice(0, 12) + '…' : provider.name, W / 2, 400)

  // 认证/类型小字
  const marks: string[] = []
  if (provider.business_verified) marks.push('✓ 商业已验证')
  else if (provider.has_license) marks.push('✓ 资质已审核')
  if (provider.phone_verified) marks.push('✓ 手机已验证')
  marks.push(provider.business_type === 'business' ? '🏢 企业商户' : '👤 自雇')
  ctx.fillStyle = provider.business_verified || provider.has_license ? '#059669' : SUB
  ctx.font = '500 22px system-ui, "PingFang SC", sans-serif'
  ctx.fillText(marks.join('   '), W / 2, 438)

  // 业务标签(最多3个)
  let ty = 490
  const tags = provider.skill_tags.slice(0, 3)
  if (tags.length) {
    ctx.font = '600 24px system-ui, "PingFang SC", sans-serif'
    const gaps = 16
    const widths = tags.map((t) => ctx.measureText('# ' + t).width + 36)
    const total = widths.reduce((a, b) => a + b, 0) + gaps * (tags.length - 1)
    let x = (W - total) / 2
    tags.forEach((t, i) => {
      const w = widths[i]
      ctx.fillStyle = '#eff6ff'; roundRect(ctx, x, ty - 30, w, 44, 22); ctx.fill()
      ctx.fillStyle = BLUE; ctx.textAlign = 'center'
      ctx.fillText('# ' + t, x + w / 2, ty)
      x += w + gaps
    })
    ty += 66
  } else {
    ty += 20
  }

  // 简介(最多2行)
  if (provider.bio?.trim()) {
    ctx.fillStyle = SUB; ctx.font = '400 24px system-ui, "PingFang SC", sans-serif'
    ctx.textAlign = 'center'
    const maxW = W - 160
    const chars = provider.bio.trim().replace(/\s+/g, ' ')
    const lines: string[] = []
    let cur = ''
    for (const ch of chars) {
      if (ctx.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch; if (lines.length === 2) break }
      else cur += ch
    }
    if (lines.length < 2 && cur) lines.push(cur)
    if (lines.length === 2 && cur && !lines.includes(cur)) lines[1] = lines[1].slice(0, -1) + '…'
    lines.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, W / 2, ty + i * 34))
    ty += lines.length * 34 + 20
  }

  // 分隔线
  ctx.strokeStyle = '#eef0f4'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(90, 858); ctx.lineTo(W - 90, 858); ctx.stroke()

  // 底部:二维码 + 文案
  const qrX = 96, qrY = 892, qrSize = 150
  if (qr) {
    ctx.fillStyle = '#fff'; roundRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 12); ctx.fill()
    ctx.drawImage(qr, qrX, qrY, qrSize, qrSize)
  }
  ctx.textAlign = 'left'
  ctx.fillStyle = INK; ctx.font = '700 30px system-ui, "PingFang SC", sans-serif'
  ctx.fillText('扫码查看 TA 的名片', qrX + qrSize + 30, qrY + 46)
  ctx.fillStyle = SUB; ctx.font = '400 23px system-ui, "PingFang SC", sans-serif'
  ctx.fillText('长按识别二维码', qrX + qrSize + 30, qrY + 88)
  ctx.fillStyle = GOLD; ctx.font = '600 23px system-ui, "PingFang SC", sans-serif'
  ctx.fillText('华邻 · 找靠谱华人师傅', qrX + qrSize + 30, qrY + 126)

  return canvas
}

export default function SharePosterModal({ provider, url, onClose }: Props) {
  const qrRef = useRef<HTMLCanvasElement>(null)
  const [img, setImg] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let cancelled = false
    let objUrl = ''
    async function build() {
      // 等二维码画布渲染出来
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
      try {
        const canvas = await drawPoster(provider, qrRef.current)
        if (cancelled) return
        canvas.toBlob((b) => {
          if (!b || cancelled) return
          objUrl = URL.createObjectURL(b)
          setImg(objUrl)
          setFile(new File([b], `华邻名片-${provider.name}.png`, { type: 'image/png' }))
          setBusy(false)
        }, 'image/png', 0.92)
      } catch {
        if (!cancelled) { setBusy(false); toast('海报生成失败,请重试') }
      }
    }
    build()
    return () => { cancelled = true; if (objUrl) URL.revokeObjectURL(objUrl) }
  }, [provider])

  async function share() {
    // 优先分享图片文件:微信收到图片可发朋友圈
    if (file && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `${provider.name}｜华邻名片` }); return }
      catch { /* cancelled or failed → 落到保存 */ }
    }
    save()
  }

  function save() {
    if (!img) return
    const a = document.createElement('a')
    a.href = img; a.download = `华邻名片-${provider.name}.png`
    document.body.appendChild(a); a.click(); a.remove()
    toast('已保存图片,去微信发给朋友或朋友圈吧', 'success')
  }

  const canShareFiles = typeof navigator !== 'undefined' && !!navigator.canShare && !!file && navigator.canShare({ files: [file] })

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="relative w-full max-w-[360px] bg-white rounded-3xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="关闭"
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50">
          <X size={18} />
        </button>

        {/* 隐藏的二维码画布(供合成用) */}
        <div className="absolute -left-[9999px] top-0" aria-hidden>
          <QRCodeCanvas value={url} size={300} level="M" ref={qrRef} />
        </div>

        <div className="p-4 pt-5">
          {busy ? (
            <div className="aspect-[750/1120] flex flex-col items-center justify-center text-gray-400 gap-2">
              <Loader2 size={28} className="animate-spin" />
              <span className="text-sm">正在生成名片海报…</span>
            </div>
          ) : (
            <img src={img} alt="名片海报" className="w-full rounded-2xl border border-gray-100" />
          )}
        </div>

        <div className="px-4 pb-5 space-y-2">
          <button onClick={share} disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white py-3 rounded-2xl font-semibold hover:bg-primary-700 active:scale-[0.98] transition disabled:opacity-50">
            <Share2 size={18} /> {canShareFiles ? '分享到微信 / 朋友圈' : '保存名片图片'}
          </button>
          {canShareFiles && (
            <button onClick={save} disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-600 py-2.5 rounded-2xl text-sm font-medium hover:bg-gray-200 transition disabled:opacity-50">
              <Download size={15} /> 保存到相册
            </button>
          )}
          <p className="text-center text-xs text-gray-400 pt-1">
            分享给朋友,或保存后发朋友圈 · 好友扫码即可查看名片
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
