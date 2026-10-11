'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, AlertTriangle, Clock, Radio } from 'lucide-react'
import CronJobDetailModal from './CronJobDetailModal'

function timeAgo(ms) {
  if (!ms) return '—'
  const diff = Date.now() - ms
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function timeUntil(ms) {
  if (!ms) return '—'
  const diff = ms - Date.now()
  if (diff <= 0) return 'overdue'
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `in ${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `in ${hours}h`
  return `in ${Math.round(hours / 24)}d`
}

const STATUS_COLORS = {
  done: 'text-green-400 border-green-500/40 bg-green-900/20',
  running: 'text-cyan-400 border-cyan-500/40 bg-cyan-900/20',
  failed: 'text-red-400 border-red-500/40 bg-red-900/20',
  skipped: 'text-yellow-400 border-yellow-500/40 bg-yellow-900/20',
}

function AgentLabel({ agentId, agentsMap }) {
  const agent = agentsMap[agentId]
  if (!agent) return <>{agentId || '—'}</>
  return (
    <span style={{ color: agent.color }}>
      {agent.emoji} {agent.name}
    </span>
  )
}

export default function ActivityDashboard() {
  const [data, setData] = useState(null)
  const [agentsMap, setAgentsMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedJobId, setSelectedJobId] = useState(null)

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((config) => setAgentsMap(config.agentsMap || {}))
      .catch(() => {})
  }, [])

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/activity')
      const json = await res.json()
      if (json.error) setError(json.error)
      else setError(null)
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActivity()
    const interval = setInterval(fetchActivity, 20000)
    return () => clearInterval(interval)
  }, [fetchActivity])

  if (loading) {
    return <div className="glass-card rounded-xl p-6 text-gray-400">Loading activity…</div>
  }

  const cronJobs = data?.cronJobs || []
  const untracked = data?.untrackedSessions || []
  const cardCount = data?.workboardCardCount ?? 0

  return (
    <div className="space-y-6">
      {error && (
        <div className="glass-card rounded-xl p-4 border border-red-500/40 text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="glass-card rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-300">
          <Radio className="w-4 h-4 text-cyan-400" />
          <span className="text-sm">
            <span className="text-cyan-400 font-bold">{cardCount}</span> Workboard cards tracked vs{' '}
            <span className="text-yellow-400 font-bold">{untracked.length}</span> untracked sessions
            (Discord chats, cron runs, direct agent sessions)
          </span>
        </div>
        <button
          onClick={fetchActivity}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-cyan-400"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Cron Jobs */}
      <div className="glass-card rounded-xl p-4">
        <h3 className="font-display text-lg mb-3 text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-400" /> Recurring / Cron Jobs
        </h3>
        <p className="text-xs text-gray-500 mb-3">Click a job to see its full history, execution details, flagged issues, and make adjustments.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-700/50">
                <th className="pb-2 pr-4">Job</th>
                <th className="pb-2 pr-4">Agent</th>
                <th className="pb-2 pr-4">Schedule</th>
                <th className="pb-2 pr-4">Last Run</th>
                <th className="pb-2 pr-4">Next Run</th>
                <th className="pb-2">Health</th>
              </tr>
            </thead>
            <tbody>
              {cronJobs.map((job) => (
                <tr
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className="border-b border-gray-800/50 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <td className="py-2 pr-4 text-gray-200">{job.name}</td>
                  <td className="py-2 pr-4 text-gray-400"><AgentLabel agentId={job.agentId} agentsMap={agentsMap} /></td>
                  <td className="py-2 pr-4 text-gray-400 font-mono text-xs">{job.schedule}</td>
                  <td className="py-2 pr-4 text-gray-400">
                    <span
                      className={`px-2 py-0.5 rounded-full border text-xs ${
                        STATUS_COLORS[job.lastRunStatus] || 'text-gray-400 border-gray-600/40'
                      }`}
                    >
                      {job.lastRunStatus || 'unknown'}
                    </span>{' '}
                    {timeAgo(job.lastRunAtMs)}
                  </td>
                  <td className="py-2 pr-4 text-gray-400">{timeUntil(job.nextRunAtMs)}</td>
                  <td className="py-2">
                    {job.consecutiveSkipped > 2 || job.consecutiveErrors > 0 ? (
                      <span className="text-xs text-yellow-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {job.consecutiveErrors > 0
                          ? `${job.consecutiveErrors} errors`
                          : `${job.consecutiveSkipped} skipped in a row`}
                        {job.lastRunError ? ` — ${job.lastRunError}` : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-green-500">healthy</span>
                    )}
                  </td>
                </tr>
              ))}
              {cronJobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-500">
                    No cron jobs configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Untracked Sessions */}
      <div className="glass-card rounded-xl p-4">
        <h3 className="font-display text-lg mb-3 text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" /> Agent Activity Outside the Workboard
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          These are real agent sessions (Discord chats, direct conversations, dashboard calls, ad-hoc
          subagent runs) that never became a Workboard card — so they didn&apos;t show up on the board.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-700/50">
                <th className="pb-2 pr-4">Session</th>
                <th className="pb-2 pr-4">Agent</th>
                <th className="pb-2 pr-4">Kind</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Tokens</th>
                <th className="pb-2">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {untracked.map((s) => (
                <tr key={s.key} className="border-b border-gray-800/50">
                  <td className="py-2 pr-4 text-gray-300 font-mono text-xs max-w-xs truncate">{s.key}</td>
                  <td className="py-2 pr-4 text-gray-400"><AgentLabel agentId={s.agentId} agentsMap={agentsMap} /></td>
                  <td className="py-2 pr-4 text-gray-400">{s.kind}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`px-2 py-0.5 rounded-full border text-xs ${
                        STATUS_COLORS[s.status] || 'text-gray-400 border-gray-600/40'
                      }`}
                    >
                      {s.status || 'unknown'}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-400">
                    {s.inputTokens != null ? `${s.inputTokens}/${s.outputTokens ?? 0}` : '—'}
                  </td>
                  <td className="py-2 text-gray-400">{timeAgo(s.lastActivityAt || s.updatedAt)}</td>
                </tr>
              ))}
              {untracked.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-500">
                    Everything is tracked — no untracked sessions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedJobId && (
        <CronJobDetailModal
          jobId={selectedJobId}
          agentsMap={agentsMap}
          onClose={() => setSelectedJobId(null)}
          onChanged={fetchActivity}
        />
      )}
    </div>
  )
}
