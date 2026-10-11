import { callGatewayMethod } from '../../../../lib/openclaw-ws'

// POST /api/agents/message — send a message/task to an agent via a stable,
// dedicated "dashboard" session (agent:<id>:dashboard:office), kept separate
// from the agent's interactive `:main` session so it never gets interleaved
// with heartbeat polls, Discord traffic, or other channel noise. The session
// is created on first use and reused for every later dashboard message to
// that agent. The reply shows up a few seconds (or, on CPU-bound local
// models, up to a couple of minutes) later — poll
// /api/workboard/session?sessionKey=agent:<id>:dashboard:office.
export async function POST(request) {
  try {
    const body = await request.json()
    const { agentId, message } = body
    if (!agentId || !message || !message.trim()) {
      return Response.json({ error: 'agentId and message are required' }, { status: 400 })
    }

    const key = `agent:${agentId}:dashboard:office`
    const trimmed = message.trim()

    try {
      const result = await callGatewayMethod('sessions.send', { key, agentId, message: trimmed })
      return Response.json({ ok: true, sessionKey: key, ...result })
    } catch (err) {
      // First message to this agent — the dedicated session doesn't exist yet.
      if (!/session not found/i.test(err.message || '')) throw err
      const result = await callGatewayMethod('sessions.create', { agentId, key, message: trimmed })
      return Response.json({ ok: true, sessionKey: key, ...result })
    }
  } catch (err) {
    return Response.json({ error: err.message || 'Gateway call failed' }, { status: 503 })
  }
}
