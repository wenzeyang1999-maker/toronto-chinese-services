// ─── Image proxy + on-demand resize, cached at the Vercel edge ────────────────
// Query-param variant (no [...catch-all] dynamic route, which wasn't being
// picked up in this bare Vite /api setup). Storage path is passed as ?path=.
//
//   /api/img?path=<bucket>/<object/path>&w=400   → 400px-wide WebP thumbnail
//   /api/img?path=<bucket>/<object/path>         → original bytes (passthrough)
//
// Fronts Supabase Storage so repeat views hit Vercel's CDN instead of Supabase
// egress. Cache-Control s-maxage=1y immutable (storage paths are timestamped).
// Fail-open: any resize error falls back to the original bytes.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import sharp from 'sharp'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://suvjhtiglecjgcnzdgfo.supabase.co'
const ALLOWED_BUCKETS = new Set(['service-images', 'avatars'])
const ALLOWED_WIDTHS  = new Set([160, 200, 400, 800, 1080])
const ONE_YEAR = 31536000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawPath = String(req.query.path ?? '')          // "<bucket>/<object/path>" (Vercel-decoded)
  const [bucket, ...rest] = rawPath.split('/')
  const objectPath = rest.map(encodeURIComponent).join('/')

  if (!bucket || !ALLOWED_BUCKETS.has(bucket) || !objectPath) {
    res.status(400).send('bad request'); return
  }

  const src = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${objectPath}`

  let buf: Buffer
  let contentType: string
  try {
    const upstream = await fetch(src)
    if (!upstream.ok) { res.status(upstream.status === 404 ? 404 : 502).send('not found'); return }
    buf = Buffer.from(await upstream.arrayBuffer())
    contentType = upstream.headers.get('content-type') || 'image/jpeg'
  } catch {
    res.status(502).send('upstream error'); return
  }

  res.setHeader('Cache-Control', `public, s-maxage=${ONE_YEAR}, max-age=86400, immutable`)

  const wRaw = parseInt(String(req.query.w ?? ''), 10)
  const w = ALLOWED_WIDTHS.has(wRaw) ? wRaw : 0

  // No width, or a GIF (keep animation) → passthrough original.
  if (!w || contentType.includes('gif')) {
    res.setHeader('Content-Type', contentType)
    res.status(200).send(buf); return
  }

  try {
    const out = await sharp(buf)
      .rotate()                                   // honor EXIF orientation
      .resize(w, null, { withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer()
    res.setHeader('Content-Type', 'image/webp')
    res.status(200).send(out)
  } catch {
    res.setHeader('Content-Type', contentType)
    res.status(200).send(buf)
  }
}
