import { callGatewayMethod } from '../../../lib/openclaw-ws'

// GET /api/activity
// Aggregates cron jobs + raw agent sessions + Workboard cards into one view so
// recurring/background agent work (heartbeat, skill review, memory promotion,
// Discord chats) that never becomes a Workboard card is still visible.
export async function GET() {
  try {
    const [cronResult, sessionsResult, workboardResult] = await Promise.all([
      callGatewayMethod('cron.list', {}),
      callGatewayMethod('sessions.list', { limit: 100 }),
      callGatewayMethod('workboard.cards.list', {}).catch(() => null),
    ])

    const jobs = (cronResult?.jobs || []).map((j) => ({
      id: j.id,
      name: j.displayName || j.name || j.declarationKey,
      agentId: j.agentId || j.effectiveAgentId || null,
      schedule:
        j.schedule?.kind === 'every'
          ? `every ${Math.round((j.schedule.everyMs || 0) / 60000)}m`
          : j.schedule?.kind === 'cron'
          ? j.schedule.expr
          : j.schedule?.kind || 'unknown',
      enabled: Boolean(j.enabled),
      lastRunAtMs: j.lastRunAtMs ?? j.state?.lastRunAtMs ?? null,
      lastRunStatus: j.lastRunStatus ?? j.state?.lastRunStatus ?? null,
      lastRunError: j.lastRunError ?? j.state?.lastError ?? null,
      nextRunAtMs: j.nextRunAtMs ?? j.state?.nextRunAtMs ?? null,
      consecutiveErrors: j.state?.consecutiveErrors ?? 0,
      consecutiveSkipped: j.state?.consecutiveSkipped ?? 0,
    }))

    const sessions = (sessionsResult?.sessions || []).map((s) => ({
      key: s.key,
      agentId: s.agentId || null,
      kind: s.classification || s.kind || 'unknown',
      status: s.status || null,
      isMain: Boolean(s.isMain),
      inputTokens: s.inputTokens ?? null,
      outputTokens: s.outputTokens ?? null,
      createdAt: s.createdAt ?? null,
      updatedAt: s.updatedAt ?? null,
      lastActivityAt: s.lastActivityAt ?? null,
    }))

    // Sessions already represented by a Workboard card (by sessionKey) shouldn't be
    // double-counted as "untracked" in the UI.
    const cards = workboardResult?.cards || []
    const trackedSessionKeys = new Set(cards.map((c) => c.sessionKey).filter(Boolean))
    const untracked = sessions.filter((s) => !trackedSessionKeys.has(s.key) && !s.key?.includes(':subagent:workboard-'))

    // Lightweight card list so consumers (e.g. the Activity Log) can label a
    // session with the real task it belongs to instead of just a session key.
    const cardsLite = cards.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      agentId: c.agentId || null,
      sessionKey: c.sessionKey || null,
    }))

    return Response.json({
      cronJobs: jobs,
      sessions,
      untrackedSessions: untracked,
      workboardCardCount: cards.length,
      cards: cardsLite,
    })
  } catch (err) {
    return Response.json({ error: err.message || 'Gateway call failed' }, { status: 503 })
  }
}
