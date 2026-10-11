'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useCallback, useEffect } from 'react'

function timeLabel(ms) {
  if (!ms) return '—'
  const diff = Date.now() - ms
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const KIND_ICON = {
  cron: '⏰',
  main: '💬',
  subagent: '🧩',
  unknown: '📋',
}

const STATUS_LABEL = {
  done: 'completed',
  running: 'running',
  failed: 'failed',
  skipped: 'skipped',
  ok: 'ran OK',
}

// Builds one human-readable detail line per event instead of a generic
// "message" field — includes what actually happened (card title, tokens,
// schedule outcome) so the log reads like a real activity feed.
function describeCronEvent(job) {
  const status = STATUS_LABEL[job.lastRunStatus] || job.lastRunStatus || 'unknown'
  let detail = `${job.name} (${job.schedule}) — ${status}`
  if (job.lastRunError) detail += ` — ${job.lastRunError}`
  else if (job.consecutiveErrors > 0) detail += ` — ${job.consecutiveErrors} errors in a row`
  return detail
}

function describeSessionEvent(session, cardBySessionKey) {
  const card = cardBySessionKey.get(session.key)
  const tokens =
    session.inputTokens != null ? `${session.inputTokens} in / ${session.outputTokens ?? 0} out tokens` : null
  if (card) {
    let detail = `${card.title} — ${card.status}`
    if (tokens) detail += ` (${tokens})`
    return detail
  }
  const kindLabel = { cron: 'Scheduled job', main: 'Direct chat', subagent: 'Delegated task' }[session.kind] || session.kind
  let detail = `${kindLabel}${session.status ? ` — ${session.status}` : ''}`
  if (tokens) detail += ` (${tokens})`
  return detail
}

export default function ActivityLog() {
  const [agentsMap, setAgentsMap] = useState({})
  const [events, setEvents] = useState([])
  const [isExpanded, setIsExpanded] = useState(true)
  const [loading, setLoading] = useState(true)
  const containerRef = useRef(null)

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((config) => setAgentsMap(config.agentsMap || {}))
      .catch(() => {})
  }, [])

  const loadActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/activity?_t=' + Date.now())
      if (!res.ok) return
      const data = await res.json()
      const cardBySessionKey = new Map((data.cards || []).filter((c) => c.sessionKey).map((c) => [c.sessionKey, c]))

      const cronEvents = (data.cronJobs || [])
        .filter((j) => j.lastRunAtMs)
        .map((j) => ({
          id: `cron:${j.id}:${j.lastRunAtMs}`,
          time: j.lastRunAtMs,
          agentId: j.agentId,
          icon: KIND_ICON.cron,
          detail: describeCronEvent(j),
        }))

      const sessionEvents = (data.sessions || [])
        .filter((s) => s.lastActivityAt || s.updatedAt)
        .map((s) => ({
          id: `session:${s.key}`,
          time: s.lastActivityAt || s.updatedAt,
          agentId: s.agentId,
          icon: KIND_ICON[s.kind] || KIND_ICON.unknown,
          detail: describeSessionEvent(s, cardBySessionKey),
        }))

      const merged = [...cronEvents, ...sessionEvents].sort((a, b) => (b.time || 0) - (a.time || 0)).slice(0, 60)
      setEvents(merged)
    } catch (e) {
      console.error('Failed to load activity:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadActivity()
    const timer = setInterval(loadActivity, 10000)
    return () => clearInterval(timer)
  }, [loadActivity])

  return (
    <motion.div
      className="glass-card rounded-xl overflow-hidden"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-purple-900/30 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <h3 className="font-display text-sm text-cyber-cyan">Activity Log</h3>
          <span className="text-[10px] text-green-500 animate-pulse">● LIVE</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{events.length} events</span>
          <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} className="text-gray-500">▼</motion.span>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div ref={containerRef} className="max-h-[600px] overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="text-center text-gray-500 text-sm py-4">Loading activity…</div>
              ) : events.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-4">
                  <span className="text-2xl block mb-2">📭</span>
                  No activity yet.
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {events.map((ev, idx) => {
                    const agent = agentsMap[ev.agentId]
                    return (
                      <motion.div
                        key={ev.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className={`flex items-start gap-2 p-2 rounded hover:bg-white/5 ${idx === 0 ? 'bg-cyan-900/20' : ''}`}
                      >
                        <span className="text-[10px] text-gray-600 font-mono w-14 flex-shrink-0">{timeLabel(ev.time)}</span>
                        <span className="text-xs flex-shrink-0">{ev.icon}</span>
                        <span
                          className="text-xs font-bold flex-shrink-0"
                          style={{ color: agent?.color || '#888' }}
                        >
                          {agent ? `${agent.emoji} ${agent.name}` : ev.agentId || 'system'}
                        </span>
                        <span className="text-xs text-gray-400 flex-1 whitespace-pre-wrap break-words">{ev.detail}</span>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
