/**
 * Recurring Job Detail API
 *
 * Backs the "click into a recurring job" modal on the All Activity page:
 * full job definition + run history + actions (run now, enable/disable,
 * edit schedule/prompt). Real gateway RPCs: cron.get, cron.runs, cron.run,
 * cron.update.
 */

import { callGatewayMethod } from '../../../../lib/openclaw-ws'

function scheduleSummary(schedule) {
  if (!schedule) return 'unknown'
  if (schedule.kind === 'every') return `every ${Math.round((schedule.everyMs || 0) / 60000)}m`
  if (schedule.kind === 'cron') return schedule.expr
  return schedule.kind
}

function normalizeJob(j) {
  if (!j) return null
  return {
    id: j.id,
    name: j.displayName || j.name || j.declarationKey,
    declarationKey: j.declarationKey || null,
    description: j.description || null,
    agentId: j.agentId || j.effectiveAgentId || null,
    enabled: Boolean(j.enabled),
    systemOwned: Boolean(j.declarationKey),
    createdAtMs: j.createdAtMs ?? null,
    schedule: j.schedule || null,
    scheduleSummary: scheduleSummary(j.schedule),
    sessionTarget: j.sessionTarget || null,
    wakeMode: j.wakeMode || null,
    payloadKind: j.payload?.kind || null,
    message: j.payload?.kind === 'agentTurn' ? j.payload.message : j.payload?.kind === 'systemEvent' ? j.payload.text : null,
    toolsAllow: j.payload?.toolsAllow || null,
    delivery: j.delivery || null,
    state: {
      nextRunAtMs: j.state?.nextRunAtMs ?? j.nextRunAtMs ?? null,
      lastRunAtMs: j.state?.lastRunAtMs ?? j.lastRunAtMs ?? null,
      lastRunStatus: j.state?.lastRunStatus ?? j.lastRunStatus ?? null,
      lastDurationMs: j.state?.lastDurationMs ?? null,
      lastError: j.state?.lastError ?? j.lastRunError ?? null,
      lastDeliveryStatus: j.state?.lastDeliveryStatus ?? null,
      consecutiveErrors: j.state?.consecutiveErrors ?? 0,
      consecutiveSkipped: j.state?.consecutiveSkipped ?? 0,
    },
  }
}

function normalizeRun(r) {
  return {
    ts: r.ts ?? r.runAtMs ?? null,
    status: r.status || null,
    completionStatus: r.completionStatus || null,
    summary: r.summary || null,
    error: r.error || null,
    runAtMs: r.runAtMs ?? null,
    durationMs: r.durationMs ?? null,
    nextRunAtMs: r.nextRunAtMs ?? null,
    deliveryStatus: r.deliveryStatus || null,
    model: r.model || null,
    provider: r.provider || null,
    usage: r.usage || null,
  }
}

export async function GET(request, { params }) {
  const { jobId } = await params
  try {
    const [jobResult, runsResult] = await Promise.all([
      callGatewayMethod('cron.get', { id: jobId }),
      callGatewayMethod('cron.runs', { id: jobId, limit: 25 }).catch(() => null),
    ])

    return Response.json({
      job: normalizeJob(jobResult),
      runs: (runsResult?.entries || []).map(normalizeRun),
    })
  } catch (err) {
    return Response.json({ error: err.message || 'Gateway call failed' }, { status: 503 })
  }
}

// POST body shapes:
//   { action: 'run' }                                — trigger a run now (debug)
//   { action: 'toggle', enabled: boolean }            — enable/disable the job
//   { action: 'update', patch: { ... } }              — generic field edit (schedule, message, etc.)
export async function POST(request, { params }) {
  const { jobId } = await params
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action } = body || {}
  try {
    if (action === 'run') {
      const result = await callGatewayMethod('cron.run', { id: jobId })
      return Response.json({ ok: true, result })
    }
    if (action === 'toggle') {
      const result = await callGatewayMethod('cron.update', { id: jobId, patch: { enabled: Boolean(body.enabled) } })
      return Response.json({ ok: true, job: normalizeJob(result) })
    }
    if (action === 'update') {
      if (!body.patch || typeof body.patch !== 'object') {
        return Response.json({ error: 'patch object is required' }, { status: 400 })
      }
      const result = await callGatewayMethod('cron.update', { id: jobId, patch: body.patch })
      return Response.json({ ok: true, job: normalizeJob(result) })
    }
    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    return Response.json({ error: err.message || 'Gateway call failed' }, { status: 503 })
  }
}
