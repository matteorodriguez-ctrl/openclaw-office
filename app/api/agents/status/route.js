import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { callGatewayMethod } from '../../../../lib/openclaw-ws'
import { getConfig } from '../../../../lib/config.js'

// Read real per-agent model assignments straight from openclaw.json — the
// office config only has display name/role/color, not the actual model.
function loadAgentModels() {
  const openclawDir = process.env.OPENCLAW_DIR || join(homedir(), '.openclaw')
  const models = {}
  let defaultModel = null
  try {
    const raw = readFileSync(join(openclawDir, 'openclaw.json'), 'utf8')
    const oc = JSON.parse(raw)
    defaultModel = oc?.agents?.defaults?.model?.primary || null
    const entries = oc?.agents?.entries || {}
    for (const [id, data] of Object.entries(entries)) {
      const m = data.model || defaultModel
      models[id] = typeof m === 'object' ? m.primary || m.fallbacks?.[0] || null : m
    }
  } catch {}
  return { models, defaultModel }
}

// The gateway's own `session.kind` field is always "direct" — the real
// session type only shows up in the key's naming convention. Used to break
// "totalSessions" down into something meaningful instead of one opaque count.
function deriveKind(key, isMain) {
  if (isMain) return 'main'
  if (/:cron:/.test(key || '')) return 'cron'
  if (/:subagent:/.test(key || '')) return 'subagent'
  if (/:dashboard:/.test(key || '')) return 'dashboard'
  return 'direct'
}

// GET /api/agents/status
// Real per-agent status for the Main Office view: is this agent actually working
// right now, on what, which model, when did it last do anything, and basic
// lifetime stats. Pulls from the same gateway RPCs the Activity tab uses
// (sessions.list, workboard.cards.list) plus cron.list for agents whose only
// "activity" is a recurring job (e.g. heartbeat).
export async function GET() {
  try {
    const config = getConfig()
    const agentIds = Object.keys(config.agents || {})
    const { models: agentModels, defaultModel } = loadAgentModels()

    const [sessionsResult, workboardResult, cronResult] = await Promise.all([
      callGatewayMethod('sessions.list', { limit: 100 }),
      callGatewayMethod('workboard.cards.list', {}).catch(() => null),
      callGatewayMethod('cron.list', {}).catch(() => null),
    ])

    const sessions = sessionsResult?.sessions || []
    const cards = workboardResult?.cards || []
    const cardBySessionKey = new Map(cards.filter((c) => c.sessionKey).map((c) => [c.sessionKey, c]))
    const jobs = cronResult?.jobs || []

    const statuses = {}
    for (const agentId of agentIds) {
      const agentSessions = sessions.filter((s) => s.agentId === agentId)
      const agentModel = agentModels[agentId] || defaultModel

      const running = agentSessions.find((s) => s.status === 'running')
      const sorted = [...agentSessions].sort(
        (a, b) => (b.lastActivityAt || b.updatedAt || 0) - (a.lastActivityAt || a.updatedAt || 0)
      )
      const latest = sorted[0]

      let currentTask = null
      if (running) {
        const card = cardBySessionKey.get(running.key)
        currentTask = card?.title || (running.kind === 'cron' ? 'Scheduled job' : 'Working…')
      }

      const totalInputTokens = agentSessions.reduce((sum, s) => sum + (s.inputTokens || 0), 0)
      const totalOutputTokens = agentSessions.reduce((sum, s) => sum + (s.outputTokens || 0), 0)

      // Breakdown of what "totalSessions" is actually made of — one main
      // conversation thread, N scheduled cron runs, N delegated subagent
      // tasks, N dashboard quick-chats, N other direct sessions.
      const sessionBreakdown = { main: 0, cron: 0, subagent: 0, dashboard: 0, direct: 0 }
      for (const s of agentSessions) {
        sessionBreakdown[deriveKind(s.key, s.isMain)] += 1
      }

      const agentJobs = jobs.filter((j) => j.agentId === agentId)
      const unhealthyJob = agentJobs.find(
        (j) => (j.state?.consecutiveErrors ?? 0) > 0 || (j.state?.consecutiveSkipped ?? 0) > 5
      )

      // Workboard cards don't always have an actively running session — a
      // card can sit in "review" (done, awaiting human sign-off) or
      // "blocked" indefinitely with no live session at all. The old status
      // logic only looked at sessions.list, so these were invisible on the
      // Office view (showed as plain "idle"). Surface them explicitly.
      const agentCards = cards.filter((c) => c.agentId === agentId)
      const blockedCards = agentCards.filter((c) => c.status === 'blocked')
      const reviewCards = agentCards.filter((c) => c.status === 'review')
      const queuedCards = agentCards.filter((c) =>
        ['triage', 'backlog', 'todo', 'scheduled', 'ready'].includes(c.status)
      )

      let status = running ? 'working' : latest?.status === 'failed' ? 'error' : 'idle'
      if (!running) {
        if (blockedCards.length) status = 'blocked'
        else if (reviewCards.length) status = 'review'
      }

      if (!currentTask) {
        if (blockedCards.length) currentTask = `Blocked: ${blockedCards[0].title}`
        else if (reviewCards.length) currentTask = `Awaiting review: ${reviewCards[0].title}`
      }

      statuses[agentId] = {
        status,
        currentTask,
        model: agentModel,
        lastActivityAt: latest?.lastActivityAt || latest?.updatedAt || null,
        lastStatus: latest?.status || null,
        totalSessions: agentSessions.length,
        sessionBreakdown,
        totalInputTokens,
        totalOutputTokens,
        cronJobCount: agentJobs.length,
        cronWarning: unhealthyJob
          ? `${unhealthyJob.name}: ${unhealthyJob.state?.lastError || 'repeated failures'}`
          : null,
        reviewCardCount: reviewCards.length,
        blockedCardCount: blockedCards.length,
        queuedCardCount: queuedCards.length,
      }
    }

    return Response.json({ agents: statuses })
  } catch (err) {
    return Response.json({ error: err.message || 'Gateway call failed', agents: {} }, { status: 503 })
  }
}
