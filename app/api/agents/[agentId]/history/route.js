import { callGatewayMethod } from '../../../../../lib/openclaw-ws'

// GET /api/agents/[agentId]/history — recent sessions for one agent (cron
// runs, subagent delegations, direct chats), newest first, with a human
// readable task description + outcome for the Main Office agent-detail
// modal's "Task History" list.

function extractCronJobId(key) {
  const m = /:cron:([^:]+)/.exec(key || '')
  return m ? m[1] : null
}

// The gateway's own `session.kind` field is always "direct" in practice —
// the actual session type only shows up in the key's naming convention.
// Derive the real kind from the key so the UI's "Scheduled job" / "Delegated
// task" labels actually trigger instead of silently falling through.
function deriveKind(key, isMain) {
  if (isMain) return 'main'
  if (/:cron:/.test(key || '')) return 'cron'
  if (/:subagent:/.test(key || '')) return 'subagent'
  if (/:dashboard:/.test(key || '')) return 'dashboard'
  return 'direct'
}

function flattenContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (part.type === 'text') return part.text
      if (part.type === 'toolCall') return `→ ${part.name}(${JSON.stringify(part.arguments || {}).slice(0, 160)})`
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

// Subagent delegations wrap the real assignment in a boilerplate preamble —
// strip it so the task description shows what the agent was actually asked
// to do, not the harness scaffolding around it.
function stripSubagentWrapper(text) {
  // "[Subagent Task]" appears twice in the wrapper — once mid-sentence in
  // the boilerplate preamble, once as the real section header right before
  // the actual assignment. Take the last occurrence.
  const marker = text.lastIndexOf('[Subagent Task]')
  if (marker === -1) return text
  return text.slice(marker + '[Subagent Task]'.length).trim()
}

function truncate(text, max) {
  const clean = text.trim().replace(/\s+/g, ' ')
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

// One gateway call per session gets us both what the agent was asked to do
// (first user message) and what it actually produced (last assistant reply)
// — the latter was previously missing entirely, so there was no way to see
// an outcome without opening the full transcript.
async function sessionSummary(key) {
  try {
    const result = await callGatewayMethod('sessions.get', { sessionKey: key, limit: 200 })
    const messages = result?.messages || []

    const firstUser = messages.find((m) => m.role === 'user')
    const firstUserText = firstUser ? flattenContent(firstUser.content) : ''
    const taskSnippet = firstUserText ? truncate(stripSubagentWrapper(firstUserText), 240) : null

    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && flattenContent(m.content).trim())
    const outcomeSnippet = lastAssistant ? truncate(flattenContent(lastAssistant.content), 240) : null

    return { taskSnippet, outcomeSnippet, messageCount: messages.length }
  } catch {
    return { taskSnippet: null, outcomeSnippet: null, messageCount: null }
  }
}

export async function GET(_request, { params }) {
  const { agentId } = await params
  if (!agentId) {
    return Response.json({ error: 'Missing agentId' }, { status: 400 })
  }

  try {
    const [sessionsResult, workboardResult, cronResult] = await Promise.all([
      callGatewayMethod('sessions.list', { limit: 100 }),
      callGatewayMethod('workboard.cards.list', {}).catch(() => null),
      callGatewayMethod('cron.list', {}).catch(() => null),
    ])

    const cards = workboardResult?.cards || []
    const cardBySessionKey = new Map(cards.filter((c) => c.sessionKey).map((c) => [c.sessionKey, c]))
    const jobsById = new Map((cronResult?.jobs || []).map((j) => [j.id, j]))

    const recent = (sessionsResult?.sessions || [])
      .filter((s) => s.agentId === agentId)
      .sort((a, b) => (b.lastActivityAt || b.updatedAt || 0) - (a.lastActivityAt || a.updatedAt || 0))
      .slice(0, 20)

    // Pull a real task/outcome summary for every session — not just the
    // ones missing a workboard/cron description — so "detail" always shows
    // what actually happened, even for cards whose static title is stale.
    const summaries = await Promise.all(recent.map((s) => sessionSummary(s.key)))
    const summaryByKey = new Map(recent.map((s, i) => [s.key, summaries[i]]))

    const out = recent.map((s) => {
      const summary = summaryByKey.get(s.key) || {}
      const card = cardBySessionKey.get(s.key)
      const jobId = extractCronJobId(s.key)
      const job = jobId ? jobsById.get(jobId) : null

      let description
      if (card) description = card.title
      else if (job) description = job.name
      else if (s.isMain) description = 'Main conversation'
      else description = summary.taskSnippet || 'Session'

      // "detail" is the expanded task description. Prefer the static
      // card/cron description when one exists — cron jobs' own first
      // message is mostly scheduler boilerplate, not useful detail — and
      // fall back to the real transcript snippet only when nothing else
      // describes the session (plain subagent/direct/dashboard chats).
      const detail = card?.description || job?.description || summary.taskSnippet || null

      return {
        key: s.key,
        kind: deriveKind(s.key, s.isMain),
        status: s.status || null,
        isMain: Boolean(s.isMain),
        description,
        detail,
        outcome: summary.outcomeSnippet || null,
        messageCount: summary.messageCount ?? null,
        inputTokens: s.inputTokens || 0,
        outputTokens: s.outputTokens || 0,
        createdAt: s.createdAt || null,
        updatedAt: s.updatedAt || null,
        lastActivityAt: s.lastActivityAt || null,
      }
    })

    return Response.json({ agentId, sessions: out })
  } catch (err) {
    return Response.json({ error: err.message || 'Gateway call failed' }, { status: 503 })
  }
}
