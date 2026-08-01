// Diagnostic function — no dependencies. If GET /api/ping returns "pong",
// Vercel IS building the /api directory as Serverless Functions. If it 404s
// with x-vercel-error: NOT_FOUND, /api is not being built at all.
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).send('pong')
}
