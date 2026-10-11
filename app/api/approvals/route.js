/**
 * Approvals API
 *
 * Read-only-plus-action proxy to the OpenClaw gateway's durable approval
 * registry. Surfaces exec and plugin approvals that are blocking an agent on
 * human sign-off (real RPCs: exec.approval.list, plugin.approval.list,
 * approval.resolve) so a stuck agent is never invisible on the dashboard.
 *
 * Note: "system-agent" approvals (the third kind the gateway supports) have
 * no dedicated list RPC exposed over the operator surface as of this
 * OpenClaw version, so they aren't included here. exec + plugin cover the
 * vast majority of real approval prompts (shell commands, plugin actions).
 */

import { callGatewayMethod } from '../../../lib/openclaw-ws'

function normalize(list, kind) {
  return (Array.isArray(list) ? list : []).map((a) => {
    const req = a.request || {}
    return {
      id: a.id,
      kind: a.approvalKind || kind,
      agentId: req.agentId || null,
      sessionKey: req.sessionKey || null,
      summary: req.commandPreview || req.command || req.title || 'Approval request',
      detail: req.description || req.detail || req.warningText || null,
      severity: req.severity || null,
      createdAtMs: a.createdAtMs || null,
      expiresAtMs: a.expiresAtMs || null,
    }
  })
}

export async function GET() {
  try {
    const [execResult, pluginResult] = await Promise.all([
      callGatewayMethod('exec.approval.list', {}).catch(() => []),
      callGatewayMethod('plugin.approval.list', {}).catch(() => []),
    ])

    const approvals = [...normalize(execResult, 'exec'), ...normalize(pluginResult, 'plugin')].sort(
      (a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0)
    )

    return Response.json({ approvals })
  } catch (err) {
    return Response.json({ error: err.message || 'Gateway call failed', approvals: [] }, { status: 503 })
  }
}

// POST { id, kind: 'exec' | 'plugin', decision: 'allow-once' | 'allow-always' | 'deny' }
export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { id, kind, decision } = body || {}
  if (!id || !kind || !decision) {
    return Response.json({ error: 'id, kind, and decision are required' }, { status: 400 })
  }
  if (!['allow-once', 'allow-always', 'deny'].includes(decision)) {
    return Response.json({ error: `Unknown decision: ${decision}` }, { status: 400 })
  }

  try {
    const result = await callGatewayMethod('approval.resolve', { id, kind, decision })
    return Response.json({ ok: true, result })
  } catch (err) {
    return Response.json({ error: err.message || 'Gateway call failed' }, { status: 503 })
  }
}
