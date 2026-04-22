import { handleDraftService } from './actions/draftService.ts'
import { handleExpandSearch } from './actions/expandSearch.ts'
import { CORS } from './lib/constants.ts'
import { requireAuth } from './lib/auth.ts'
import { jsonResponse } from './lib/http.ts'
import type { Action, ActionPayload } from './lib/types.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    await requireAuth(req)

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
