import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { callGatewayMethod } from '../../../../lib/openclaw-ws'
import { getConfig } from '../../../../lib/config.js'
import { computeCostComparison } from '../../../../lib/cost.js'

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

// GET /api/stats/cost
// Real cost comparison: actual token usage (from the gateway's own session
// records) priced at each agent's real model cost (free for local/OpenRouter
// free-tier models) vs. what the same token volume would cost on a
// mainstream paid commercial API. This is the real basis for "savings" —
// not an arbitrary time multiplier.
export async function GET() {
  try {
    const config = getConfig()
    const agentIds = Object.keys(config.agents || {})
    const { models: agentModels, defaultModel } = loadAgentModels()

    const sessionsResult = await callGatewayMethod('sessions.list', { limit: 200 })
    const sessions = sessionsResult?.sessions || []

    const agentUsage = agentIds.map((id) => {
      const agentSessions = sessions.filter((s) => s.agentId === id)
      const inputTokens = agentSessions.reduce((sum, s) => sum + (s.inputTokens || 0), 0)
      const outputTokens = agentSessions.reduce((sum, s) => sum + (s.outputTokens || 0), 0)
      return {
        id,
        model: agentModels[id] || defaultModel,
        inputTokens,
        outputTokens,
      }
    })

    const comparison = computeCostComparison(agentUsage)
    return Response.json(comparison)
  } catch (err) {
    return Response.json({ error: err.message || 'Gateway call failed' }, { status: 503 })
  }
}
