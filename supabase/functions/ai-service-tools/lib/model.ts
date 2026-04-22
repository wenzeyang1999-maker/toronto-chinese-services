export async function askModel(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY')
  if (!apiKey) throw new Error('GROQ_API_KEY secret not configured')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '你是结构化输出助手。只输出合法 JSON，不要输出 markdown，不要解释。',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`Groq error ${res.status}: ${await res.text()}`)
  }

  const json = await res.json()
  return json.choices?.[0]?.message?.content ?? '{}'
}
