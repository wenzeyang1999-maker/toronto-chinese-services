// ─── 访客地区检测 ─────────────────────────────────────────────────────────────
// 返回 Vercel 边缘识别的来源国家码(x-vercel-ip-country)。前端据此对中国大陆 IP
// 软限制:可浏览,但禁注册/禁发布。浏览不拦(不影响 SEO 与加拿大用户)。
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  const country = String(req.headers['x-vercel-ip-country'] || '').toUpperCase()
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ country })
}
