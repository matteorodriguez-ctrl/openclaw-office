'use client'

import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

const STATUS_LABEL = {
  working: 'Working',
  review: 'Awaiting review',
  blocked: 'Blocked',
  error: 'Hit an error',
  idle: 'Idle',
}

const STATUS_EMOJI = {
  working: '⚡',
  review: '🕵️',
  blocked: '⛔',
  error: '⚠️',
  idle: '😴',
}

function timeAgo(ms) {
  if (!ms) return null
  const diff = Date.now() - ms
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

function AgentCard({ agent, liveStatus, statsRow, thoughts }) {
  const status = liveStatus?.status || 'idle'
  const headline = liveStatus?.currentTask
    ? liveStatus.currentTask
    : status === 'working'
    ? 'Working…'
    : `${STATUS_LABEL[status] || 'Idle'} — no active task.`

  const conversations = liveStatus?.totalSessions ?? 0
  const completed = statsRow?.tasks_completed ?? 0
  const cronJobs = liveStatus?.cronJobCount ?? 0
  const tokens = (liveStatus?.totalInputTokens ?? 0) + (liveStatus?.totalOutputTokens ?? 0)

  return (
    <motion.div
      className="glass-card rounded-xl p-4 relative overflow-hidden group"
      whileHover={{ scale: 1.01 }}
      style={{ borderColor: agent.color + '44' }}
    >
      <div
        className="absolute -top-10 -right-10 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity"
        style={{ background: `radial-gradient(circle, ${agent.color}, transparent)` }}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl relative"
          style={{ background: `${agent.color}22`, border: `2px solid ${agent.color}`, boxShadow: `0 0 10px ${agent.color}44` }}
        >
          {agent.emoji}
          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${status === 'working' ? 'status-online' : 'bg-gray-500'}`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-display font-bold" style={{ color: agent.color }}>{agent.name}</h4>
            <span className="text-lg" title={STATUS_LABEL[status] || 'Idle'}>{STATUS_EMOJI[status] || '😎'}</span>
          </div>
          <p className="text-xs text-gray-500">{agent.role}</p>
        </div>
      </div>

      {/* Current task */}
      <motion.div
        className="bg-gray-900/50 rounded-lg p-3 mb-3 min-h-[50px]"
        key={headline}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-sm text-gray-300 italic">"{headline}"</p>
      </motion.div>

      {/* Recent thoughts — real text pulled from the agent's most recently
          active session, not just a status label. */}
      <div className="mb-3">
        <div className="text-cyan-400 text-xs font-bold uppercase mb-1">Recent Thoughts</div>
        {(!thoughts || thoughts.length === 0) && (
          <div className="text-gray-600 text-xs italic">Nothing recorded yet.</div>
        )}
        {thoughts && thoughts.length > 0 && (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {thoughts.map((t, i) => (
              <div key={i} className="bg-black/30 border border-gray-800 rounded-lg px-2.5 py-1.5">
                <div className="text-gray-300 text-xs whitespace-pre-wrap break-words line-clamp-3">{t.text}</div>
                {t.timestamp && <div className="text-gray-600 text-[10px] mt-0.5">{timeAgo(t.timestamp)}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="text-xs text-gray-500">💬</div>
          <div className="text-sm font-bold" style={{ color: agent.color }}>{conversations}</div>
          <div className="text-[10px] text-gray-600">sessions</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">✅</div>
          <div className="text-sm font-bold text-green-400">{completed}</div>
          <div className="text-[10px] text-gray-600">done</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">⏰</div>
          <div className="text-sm font-bold text-cyan-400">{cronJobs}</div>
          <div className="text-[10px] text-gray-600">cron jobs</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">🔢</div>
          <div className="text-sm font-bold text-purple-400">{tokens > 1000 ? `${(tokens / 1000).toFixed(0)}k` : tokens}</div>
          <div className="text-[10px] text-gray-600">tokens</div>
        </div>
      </div>
    </motion.div>
  )
}

function MemoryAndDreams({ memory }) {
  if (!memory) return null
  const hasAny =
    (memory.diaryEntries && memory.diaryEntries.length > 0) ||
    memory.remReflections ||
    (memory.lightSleepCandidates && memory.lightSleepCandidates.length > 0)

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">🌙</span>
        <h3 className="text-cyan-400 font-bold">Memory &amp; Dreams</h3>
      </div>
      <div className="text-gray-500 text-xs mb-3">
        OpenClaw's nightly memory-consolidation runs — all agents here share one workspace, so this is shared across
        them rather than per-agent. <span className="text-cyan-500">Light sleep</span> stages raw candidates,{' '}
        <span className="text-cyan-500">REM sleep</span> looks for lasting patterns, and the{' '}
        <span className="text-cyan-500">diary</span> logs what happened each run.
      </div>

      {!hasAny && (
        <div className="text-gray-500 text-sm py-4 text-center">
          <span className="text-2xl block mb-2">💤</span>
          No dream/memory runs recorded yet — this builds up over the first few nights.
        </div>
      )}

      {hasAny && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Diary */}
          <div>
            <div className="text-xs font-bold uppercase text-gray-400 mb-1">📔 Dream Diary</div>
            {(!memory.diaryEntries || memory.diaryEntries.length === 0) && (
              <div className="text-gray-600 text-xs italic">No entries yet.</div>
            )}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {memory.diaryEntries?.map((e, i) => (
                <div key={i} className="bg-black/30 border border-gray-800 rounded-lg p-2">
                  {e.date && <div className="text-gray-600 text-[10px] mb-0.5">{e.date}</div>}
                  <div className="text-gray-300 text-xs whitespace-pre-wrap break-words">{e.text}</div>
                </div>
              ))}
            </div>
          </div>

          {/* REM reflections */}
          <div>
            <div className="text-xs font-bold uppercase text-gray-400 mb-1">
              🧠 REM Reflections {memory.remDate && <span className="text-gray-600 normal-case">({memory.remDate})</span>}
            </div>
            {!memory.remReflections && <div className="text-gray-600 text-xs italic">No REM run yet.</div>}
            {memory.remReflections && (
              <div className="space-y-2">
                <div>
                  <div className="text-gray-500 text-[10px] uppercase mb-0.5">Reflections</div>
                  {memory.remReflections.reflections.map((r, i) => (
                    <div key={i} className="text-gray-300 text-xs">• {r}</div>
                  ))}
                </div>
                <div>
                  <div className="text-gray-500 text-[10px] uppercase mb-0.5">Lasting Truths</div>
                  {memory.remReflections.truths.map((t, i) => (
                    <div key={i} className="text-purple-300 text-xs">• {t}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Light sleep candidates */}
          <div>
            <div className="text-xs font-bold uppercase text-gray-400 mb-1">
              💭 Staged Memories {memory.lightSleepDate && <span className="text-gray-600 normal-case">({memory.lightSleepDate})</span>}
            </div>
            {(!memory.lightSleepCandidates || memory.lightSleepCandidates.length === 0) && (
              <div className="text-gray-600 text-xs italic">None staged yet.</div>
            )}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {memory.lightSleepCandidates?.map((c, i) => (
                <div key={i} className="bg-black/30 border border-gray-800 rounded-lg p-2">
                  <div className="text-gray-300 text-xs whitespace-pre-wrap break-words line-clamp-2">{c.text}</div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-600">
                    {c.confidence != null && <span>confidence {Math.round(c.confidence * 100)}%</span>}
                    {c.status && <span className="text-yellow-500">{c.status}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TeamDashboard() {
  const [agents, setAgents] = useState([])
  const [liveStatuses, setLiveStatuses] = useState({})
  const [statsRows, setStatsRows] = useState({})
  const [thoughtsByAgent, setThoughtsByAgent] = useState({})
  const [memory, setMemory] = useState(null)

  useEffect(() => {
    const load = () => {
      fetch('/api/config').then(r => r.json()).then(data => {
        setAgents(data.agents || [])
      }).catch(() => {})
      fetch('/api/agents/status').then(r => r.json()).then(data => {
        setLiveStatuses(data.agents || {})
      }).catch(() => {})
      fetch('/api/stats/agents').then(r => r.json()).then(data => {
        const rows = {}
        for (const row of data.agents || []) rows[row.id] = row
        setStatsRows(rows)
      }).catch(() => {})
      fetch('/api/thoughts').then(r => r.json()).then(data => {
        const byAgent = {}
        for (const a of data.agents || []) byAgent[a.id] = a.recentThoughts
        setThoughtsByAgent(byAgent)
        setMemory(data.memory || null)
      }).catch(() => {})
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🤖</span>
        <h2 className="font-display text-xl text-cyber-cyan">AI Team Dashboard</h2>
      </div>

      <p className="text-sm text-gray-500 -mt-4">
        🎧 What each agent is working on right now, what it's actually been saying/doing recently, and what's
        surfaced from overnight memory consolidation.
      </p>

      {/* Agent cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent, index) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <AgentCard
              agent={agent}
              liveStatus={liveStatuses[agent.id]}
              statsRow={statsRows[agent.id]}
              thoughts={thoughtsByAgent[agent.id]}
            />
          </motion.div>
        ))}
      </div>

      <MemoryAndDreams memory={memory} />
    </div>
  )
}
