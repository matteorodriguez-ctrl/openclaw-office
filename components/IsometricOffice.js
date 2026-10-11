'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import AgentDetailModal from './AgentDetailModal'

function timeAgo(ms) {
  if (!ms) return 'never'
  const diff = Date.now() - ms
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

function shortModel(model) {
  if (!model) return null
  const parts = model.split('/')
  return parts[parts.length - 1]
}

const STATUS_META = {
  working: { color: '#ffd700', label: 'Working' },
  idle: { color: '#39ff14', label: 'Idle' },
  error: { color: '#ff3860', label: 'Error' },
  review: { color: '#ff9f1c', label: 'Needs Review' },
  blocked: { color: '#ff3860', label: 'Blocked' },
}

// One row per agent — click anywhere on the row to open the detail modal
// (task history + direct chat). Replaces the old draggable isometric office
// floor, which didn't convey any useful information.
function AgentListRow({ agent, liveStatus, isWorking, task, onClick }) {
  const status = isWorking ? 'working' : liveStatus?.status === 'error' ? 'error' : liveStatus?.status || 'idle'
  const meta = STATUS_META[status] || STATUS_META.idle
  const currentTaskText = isWorking && task?.detail
    ? task.detail
    : liveStatus?.currentTask
    ? liveStatus.currentTask
    : null

  return (
    <motion.button
      onClick={() => onClick(agent)}
      layout
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="w-full text-left rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4 transition-colors"
      style={{
        background: 'rgba(10, 10, 26, 0.85)',
        border: `1px solid ${agent.color}40`,
        boxShadow: isWorking ? `0 0 14px ${agent.color}30` : 'none',
      }}
    >
      {/* Avatar + status dot */}
      <div className="relative flex-shrink-0">
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-lg sm:text-xl font-bold"
          style={{ background: `${agent.color}20`, border: `2px solid ${agent.color}` }}
        >
          {agent.emoji || agent.name?.[0] || '?'}
        </div>
        <motion.div
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900"
          style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
          animate={status === 'working' ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      </div>

      {/* Name / role / model */}
      <div className="min-w-0 flex-shrink-0 w-28 sm:w-40">
        <div className="font-display font-bold text-white text-sm sm:text-base truncate">{agent.name}</div>
        <div className="text-[10px] sm:text-xs text-gray-400 truncate">{agent.role}</div>
      </div>

      {/* Status + current task / last activity */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold" style={{ color: meta.color }}>{meta.label}</span>
          {liveStatus?.model && (
            <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-500/30">
              {shortModel(liveStatus.model)}
            </span>
          )}
          {liveStatus?.reviewCardCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-900/40 text-orange-300 border border-orange-500/30">
              {liveStatus.reviewCardCount} to review
            </span>
          )}
          {liveStatus?.blockedCardCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-900/40 text-red-300 border border-red-500/30">
              {liveStatus.blockedCardCount} blocked
            </span>
          )}
          {liveStatus?.queuedCardCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-600/30">
              {liveStatus.queuedCardCount} queued
            </span>
          )}
          <span className="text-[10px] sm:text-xs text-gray-500">
            {status === 'working' ? 'since just now' : `last active ${timeAgo(liveStatus?.lastActivityAt)}`}
          </span>
        </div>
        <div className="text-xs sm:text-sm text-gray-300 truncate mt-0.5">
          {currentTaskText || (liveStatus ? 'No active task' : '—')}
        </div>
        {liveStatus?.cronWarning && (
          <div className="text-red-400 text-[10px] sm:text-xs mt-0.5 truncate">⚠ {liveStatus.cronWarning}</div>
        )}
      </div>

      <div className="hidden sm:block text-gray-600 text-xs flex-shrink-0">
        {liveStatus?.totalSessions != null ? `${liveStatus.totalSessions} sessions` : ''}
      </div>

      <span className="text-gray-600 flex-shrink-0">›</span>
    </motion.button>
  )
}

export default function IsometricOffice() {
  const [time, setTime] = useState('')
  const [mounted, setMounted] = useState(false)
  const [savedAmount, setSavedAmount] = useState(null)
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [liveStatuses, setLiveStatuses] = useState({})

  // Client-side only initialization — load agents from config endpoint
  useEffect(() => {
    setMounted(true)
    setTime(new Date().toLocaleTimeString())

    fetch('/api/config')
      .then((r) => r.json())
      .then((config) => {
        const rawAgents = config.agents || {}
        const agentList = Array.isArray(rawAgents)
          ? rawAgents.map((a) => ({ ...a, status: 'online' }))
          : Object.entries(rawAgents).map(([id, data]) => ({ id, ...data, status: 'online' }))
        setAgents(agentList)
      })
      .catch((e) => console.error('Failed to load config:', e))
  }, [])

  // Update clock
  useEffect(() => {
    if (!mounted) return
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(timer)
  }, [mounted])

  // Fetch real cost-avoided figure (token-based, from gateway usage)
  useEffect(() => {
    if (!mounted) return
    const fetchSavings = async () => {
      try {
        const res = await fetch('/api/stats/cost?_t=' + Date.now())
        if (res.ok) {
          const data = await res.json()
          setSavedAmount(data.totals?.savingsUsd ?? 0)
        }
      } catch (e) { /* ignore */ }
    }
    fetchSavings()
    const timer = setInterval(fetchSavings, 60000)
    return () => clearInterval(timer)
  }, [mounted])

  // Fetch real per-agent status (cron/session/workboard-backed)
  useEffect(() => {
    if (!mounted) return
    const fetchStatuses = async () => {
      try {
        const res = await fetch('/api/agents/status?_t=' + Date.now())
        if (res.ok) {
          const data = await res.json()
          setLiveStatuses(data.agents || {})
        }
      } catch (e) { /* ignore */ }
    }
    fetchStatuses()
    const timer = setInterval(fetchStatuses, 15000)
    return () => clearInterval(timer)
  }, [mounted])

  if (!mounted) {
    return <div className="relative w-full rounded-xl bg-gray-900 min-h-[300px]" />
  }

  return (
    <div className="office-container relative w-full rounded-xl p-3 sm:p-4" style={{ background: 'rgba(5,5,15,0.6)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-900/70 border border-green-500/50">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-400 font-bold">LIVE</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-gray-900/70 border border-cyan-500/30">
            <span className="text-xs text-cyan-400 font-mono">{time}</span>
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-gray-900/70 border border-green-500/50" title="Vs. equivalent token volume on a paid commercial API — reference only, not a quality-equivalence claim">
          <span className="text-xs text-green-400 font-bold">
            💰 Cost avoided: ${savedAmount !== null ? savedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '...'}
          </span>
        </div>
      </div>

      {/* Agent list — click a row to open history + chat */}
      <div className="space-y-2">
        {agents.map((agent) => (
          <AgentListRow
            key={agent.id}
            agent={agent}
            liveStatus={liveStatuses[agent.id]}
            isWorking={liveStatuses[agent.id]?.status === 'working'}
            task={null}
            onClick={setSelectedAgent}
          />
        ))}
        {agents.length === 0 && (
          <div className="text-gray-500 text-sm text-center py-8">Loading agents…</div>
        )}
      </div>

      {/* Agent detail modal — task history + direct message input */}
      <AnimatePresence>
        {selectedAgent && (
          <AgentDetailModal
            agent={selectedAgent}
            liveStatus={liveStatuses[selectedAgent.id]}
            onClose={() => setSelectedAgent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
