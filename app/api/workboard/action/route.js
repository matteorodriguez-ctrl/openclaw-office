import { callGatewayMethod } from '../../../../lib/openclaw-ws'

// POST { cardId, action: 'accept' | 'decline' | 'comment', feedback?: string }
export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { cardId, action, feedback } = body || {}
  if (!cardId || !action) {
    return Response.json({ error: 'cardId and action are required' }, { status: 400 })
  }

  try {
    // Attach feedback as a comment first (if provided), then apply the status transition.
    if (feedback && feedback.trim()) {
      await callGatewayMethod('workboard.cards.comment', { id: cardId, body: feedback.trim() })
    }

    let result
    if (action === 'accept') {
      result = await callGatewayMethod('workboard.cards.move', { id: cardId, status: 'done' })
    } else if (action === 'decline') {
      // Move to ready (not todo — dispatch only picks up ready/scheduled cards) and
      // immediately trigger a redispatch so the rework actually kicks off a new agent run.
      await callGatewayMethod('workboard.cards.move', { id: cardId, status: 'ready' })
      result = await callGatewayMethod('workboard.cards.dispatch', {})
    } else if (action === 'comment') {
      // Feedback-only, no status change — already applied above.
      result = { ok: true }
    } else {
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    return Response.json({ ok: true, result })
  } catch (err) {
    return Response.json({ error: err.message || 'Gateway call failed' }, { status: 503 })
  }
}
