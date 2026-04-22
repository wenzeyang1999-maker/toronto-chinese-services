import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

export async function fetchServiceTitles(): Promise<string[]> {
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anonKey) return []

  const client = createClient(url, anonKey)
  const { data } = await client
    .from('services')
    .select('title')
    .eq('is_available', true)
    .order('created_at', { ascending: false })
    .limit(80)

  return (data ?? []).map((row: { title: string }) => row.title)
}
