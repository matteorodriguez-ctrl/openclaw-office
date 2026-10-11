import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'
import { callGatewayMethod } from '../../../lib/openclaw-ws'
import { getConfig } from '../../../lib/config.js'

// GET /api/thoughts — real content for the Agent Thoughts tab: each agent's
// actual recent reasoning/replies (not just a status label), plus the shared
// OpenClaw memory-core "dreaming" system (DREAMS.md diary, REM reflections,
// light-sleep promotion candidates). All agents here share one workspace, so
// memory/dreams are workspace-wide rather than per-agent.

function openclawDir() {
  return process.env.OPENCLAW_DIR || join(homedir(), '.openclaw')
}

function loadWorkspaceDir() {
  // openclaw.json stores the host's absolute workspace path, but inside the
  // container that same tree is mounted at OPENCLAW_DIR — so always resolve
  // relative to the mount, not the literal config string.
  const candidate = join(openclawDir(), 'workspace')
  if (existsSync(candidate)) return candidate
  try {
    const raw = readFileSync(join(openclawDir(), 'openclaw.json'), 'utf8')
    const oc = JSON.parse(raw)
    const configured = oc?.agents?.defaults?.workspace || null
    return configured && existsSync(configured) ? configured : null
  } catch {
    return null
  }
}

function flattenContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (part.type === 'text') return part.text
      if (part.type === 'toolCall') return `→ used tool "${part.name}"`
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function truncate(text, max) {
  const clean = text.trim().replace(/\s+/g, ' ')
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

async function recentThoughtsForAgent(agentId, sessions) {
  const agentSessions = sessions.filter((s) => s.agentId === agentId)
  const sorted = [...agentSessions].sort(
    (a, b) => (b.lastActivityAt || b.updatedAt || 0) - (a.lastActivityAt || a.updatedAt || 0)
  )
  const latest = sorted[0]
  if (!latest) return []
  try {
    const result = await callGatewayMethod('sessions.get', { sessionKey: latest.key, limit: 60 })
    const messages = result?.messages || []
    return messages
      .filter((m) => m.role === 'assistant')
      .map((m) => ({ text: flattenContent(m.content), timestamp: m.timestamp }))
      .filter((t) => t.text && t.text.trim())
      .slice(-5)
      .reverse()
      .map((t) => ({ text: truncate(t.text, 220), timestamp: t.timestamp }))
  } catch {
    return []
  }
}

// DREAMS.md is a running diary of nightly dream-promotion runs, delimited by
// `---` between entries, each starting with an italicized date line.
function parseDiary(text) {
  if (!text) return []
  const start = text.indexOf('<!-- openclaw:dreaming:diary:start -->')
  const end = text.indexOf('<!-- openclaw:dreaming:diary:end -->')
  const body = start !== -1 && end !== -1 ? text.slice(start, end) : text
  const blocks = body
    .split(/^---$/m)
    .map((b) => b.trim())
    .filter(Boolean)
  const entries = []
  for (const block of blocks) {
    const dateMatch = /^\*(.+?)\*/.exec(block)
    const date = dateMatch ? dateMatch[1] : null
    const rest = (dateMatch ? block.slice(dateMatch[0].length) : block).trim()
    if (rest && !rest.startsWith('<!--')) entries.push({ date, text: rest })
  }
  return entries.reverse()
}

function parseRem(text) {
  if (!text) return null
  const reflMatch = /### Reflections\n([\s\S]*?)(\n###|$)/.exec(text)
  const truthMatch = /### Possible Lasting Truths\n([\s\S]*?)(\n###|$)/.exec(text)
  const parseList = (s) =>
    (s || '')
      .split('\n')
      .map((l) => l.replace(/^-\s*/, '').trim())
      .filter(Boolean)
  return { reflections: parseList(reflMatch?.[1]), truths: parseList(truthMatch?.[1]) }
}

function parseLightSleep(text, limit = 6) {
  if (!text) return []
  const blocks = text
    .split(/\n(?=- Candidate:)/)
    .map((b) => b.trim())
    .filter((b) => b.startsWith('- Candidate:'))
  return blocks.slice(0, limit).map((block) => {
    const lines = block.split('\n')
    const candidate = lines[0].replace('- Candidate:', '').trim()
    const confMatch = /confidence:\s*([\d.]+)/.exec(block)
    const statusMatch = /status:\s*(\w+)/.exec(block)
    return {
      text: truncate(candidate, 200),
      confidence: confMatch ? parseFloat(confMatch[1]) : null,
      status: statusMatch ? statusMatch[1] : null,
    }
  })
}

function latestFile(dir) {
  if (!existsSync(dir)) return null
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
  if (!files.length) return null
  return join(dir, files[files.length - 1])
}

function loadMemory(workspace) {
  if (!workspace) return null
  try {
    const diaryPath = join(workspace, 'DREAMS.md')
    const diaryText = existsSync(diaryPath) ? readFileSync(diaryPath, 'utf8') : null
    const remFile = latestFile(join(workspace, 'memory/dreaming/rem'))
    const lightFile = latestFile(join(workspace, 'memory/dreaming/light'))
    return {
      diaryEntries: parseDiary(diaryText).slice(0, 10),
      remReflections: remFile ? parseRem(readFileSync(remFile, 'utf8')) : null,
      remDate: remFile ? basename(remFile, '.md') : null,
      lightSleepCandidates: lightFile ? parseLightSleep(readFileSync(lightFile, 'utf8')) : [],
      lightSleepDate: lightFile ? basename(lightFile, '.md') : null,
    }
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const config = getConfig()
    const agentIds = Object.keys(config.agents || {})
    const sessionsResult = await callGatewayMethod('sessions.list', { limit: 100 })
    const sessions = sessionsResult?.sessions || []

    const thoughtLists = await Promise.all(agentIds.map((id) => recentThoughtsForAgent(id, sessions)))
    const agents = agentIds.map((id, i) => ({ id, recentThoughts: thoughtLists[i] }))

    const memory = loadMemory(loadWorkspaceDir())

    return Response.json({ agents, memory })
  } catch (err) {
    return Response.json({ error: err.message || 'Failed to load thoughts', agents: [], memory: null }, { status: 200 })
  }
}
