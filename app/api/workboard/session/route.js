import { callGatewayMethod } from '../../../../lib/openclaw-ws'

// Collapse a transcript message into plain text for display.
function flattenContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return JSON.stringify(content)
  return content
    .map((part) => {
      if (part.type === 'text') return part.text
      if (part.type === 'toolCall') return `→ called tool "${part.arguments?.id || part.name}" with ${JSON.stringify(part.arguments?.args ?? part.arguments ?? {})}`
      return JSON.stringify(part)
    })
    .join('\n')
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const sessionKey = searchParams.get('sessionKey')
  if (!sessionKey) {
    return Response.json({ error: 'Missing sessionKey' }, { status: 400 })
  }

  try {
    const result = await callGatewayMethod('sessions.get', { sessionKey, limit: 200 })
    const messages = (result?.messages || []).map((m) => ({
      role: m.role,
      text: flattenContent(m.content),
      timestamp: m.timestamp,
      isError: Boolean(m.isError),
    }))
    return Response.json({ sessionKey, messages })
  } catch (err) {
    return Response.json({ error: err.message || 'Gateway call failed' }, { status: 503 })
  }
}
