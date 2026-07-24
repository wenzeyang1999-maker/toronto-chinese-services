// ─── Image proxy + on-demand resize, cached at the Vercel edge ────────────────
// Fronts Supabase Storage so repeat views are served from Vercel's CDN instead
// of counting against Supabase's tiny 5GB egress. Also downsizes on the fly, so
// list pages can request small thumbnails (?w=400) of ANY image — old or new —
// without storing separate thumbnail files.
//
//   /api/img/<bucket>/<object/path>?w=400   → 400px-wide WebP thumbnail
//   /api/img/<bucket>/<object/path>         → original bytes (passthrough)
//
// Cache-Control s-maxage=1y + immutable: storage paths are unique (timestamped),
// so a cached transform never goes stale. Fail-open: any resize error falls back
// to the original bytes rather than a broken image.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import sharp from 'sharp'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://suvjhtiglecjgcnzdgfo.supabase.co'
const ALLOWED_BUCKETS = new Set(['service-images', 'avatars'])
const ALLOWED_WIDTHS  = new Set([160, 200, 400, 800, 1080])
const ONE_YEAR = 31536000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const parts = ([] as string[]).concat((req.query.path as string[] | string) ?? [])
  const bucket = parts[0]
  const objectPath = parts.slice(1).map(encodeURIComponent).join('/')

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
    // Fail open — serve the original rather than a broken image.
    res.setHeader('Content-Type', contentType)
    res.status(200).send(buf)
  }
}
