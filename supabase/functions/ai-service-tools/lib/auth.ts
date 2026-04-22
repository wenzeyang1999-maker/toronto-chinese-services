import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

export async function requireAuth(req: Request): Promise<void> {
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anonKey) throw new Error('Supabase env missing')

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Unauthorized')
}
