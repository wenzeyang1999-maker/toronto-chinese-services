import { handleDraftService } from './actions/draftService.ts'
import { handleExpandSearch } from './actions/expandSearch.ts'
import { CORS } from './lib/constants.ts'
import { requireAuth } from './lib/auth.ts'
import { jsonResponse } from './lib/http.ts'
import { allowAiCallByUser } from '../_shared/aiRateLimit.ts'
import type { Action, ActionPayload } from './lib/types.ts'

const RL_MAX    = 40              // AI tool calls per user per window
const RL_WINDOW = 10 * 60 * 1000  // 10 minutes

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const uid = await requireAuth(req)
    if (!(await allowAiCallByUser(uid, 'ai-service-tools', RL_MAX, RL_WINDOW))) {
      return jsonResponse({ error: '操作过于频繁，请稍后再试' }, 429)
    }

    const { action, payload } = await req.json() as {
      action: Action
      payload: ActionPayload
    }

    if (action === 'expand_search') {
      return await handleExpandSearch(payload)
    }

    if (action === 'draft_service') {
      return await handleDraftService(payload)
    }

    return jsonResponse({ error: 'unknown action' }, 400)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return jsonResponse({ error: msg }, status)
  }
})
