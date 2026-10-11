/**
 * Agent Pause/Resume Control
 *
 * Wraps the OpenClaw gateway's cooperative suspension RPCs
 * (gateway.suspend.prepare / .status / .resume) so the Office dashboard
 * can stop all cron/automation dispatch (heartbeats, soak checks, new
 * agent work) with a single button — useful for CPU-only testing where
 * concurrent agent activity overloads the single inference slot.
 *
 * Important semantics (confirmed by live testing against this gateway):
 *  - prepare() always pauses cron scheduling first, then checks if the
 *    gateway is idle. Without drain:true, if work is active it silently
 *    un-pauses and resumes before returning — i.e. a non-draining prepare
 *    has NO lasting effect while busy. We always pass drain:true so the
 *    pause sticks (active work is allowed to finish naturally, not killed).
 *  - While suspended, almost every other gateway RPC (cron.*, sessions.*,
 *    workboard.*, etc.) returns "... unavailable during gateway
 *    suspension" errors. suspend.status and suspend.resume keep working.
 *    Because of this, the dashboard can't just "ask the gateway" whether
 *    it's paused — we persist the pause state ourselves (app_state table)
 *    so the UI stays accurate even while the gateway is read-blocked.
 *  - We reuse one fixed requestId so repeat "pause" calls are treated as
 *    idempotent renewals (refreshing the suspension TTL) rather than
 *    conflicts.
 */

import { callGatewayMethod } from '../../../../lib/openclaw-ws'
import { getAppState, setAppState, clearAppState } from '../../../../lib/db'

const STATE_KEY = 'gateway_pause'
const REQUEST_ID = 'openclaw-office-dashboard-pause'

export async function GET() {
  const state = getAppState(STATE_KEY, { paused: false })
  return Response.json(state)
}

// POST { action: 'pause' | 'resume' }
export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action } = body || {}

  if (action === 'pause') {
    try {
      const result = await callGatewayMethod('gateway.suspend.prepare', {
        requestId: REQUEST_ID,
        terminalPolicy: 'preserve',
        drain: true,
      })

      const state = {
        paused: true,
        suspensionId: result?.suspensionId || null,
        status: result?.status || 'draining',
        pausedAtMs: Date.now(),
        expiresAtMs: result?.expiresAtMs || null,
        activeCount: result?.activeCount ?? null,
        blockers: result?.blockers || null,
      }
      setAppState(STATE_KEY, state)
      return Response.json(state)
    } catch (err) {
      return Response.json({ error: err.message || 'Failed to pause gateway' }, { status: 503 })
    }
  }

  if (action === 'resume') {
    const current = getAppState(STATE_KEY, { paused: false })
    if (!current.paused || !current.suspensionId) {
      // Nothing locally tracked as paused — clear any stale state and report resumed.
      clearAppState(STATE_KEY)
      return Response.json({ paused: false })
    }

    try {
      const result = await callGatewayMethod('gateway.suspend.resume', {
        suspensionId: current.suspensionId,
      })
      clearAppState(STATE_KEY)
      return Response.json({ paused: false, resumed: !!result?.resumed })
    } catch (err) {
      // Even if the resume RPC fails (e.g. suspension already expired on
      // the gateway side), don't leave the dashboard stuck believing it's
      // still paused — clear local state so the user can retry cleanly.
      clearAppState(STATE_KEY)
      return Response.json(
        { paused: false, warning: err.message || 'Resume call failed, but local pause state was cleared' },
        { status: 200 }
      )
    }
  }

  return Response.json({ error: "action must be 'pause' or 'resume'" }, { status: 400 })
}
