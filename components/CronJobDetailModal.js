'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Play, AlertTriangle, CheckCircle2, Pencil, Save, Ban } from 'lucide-react'

function timeAgo(ms) {
  if (!ms) return 'never'
  const diff = Date.now() - ms
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

function timeUntil(ms) {
  if (!ms) return '—'
  const diff = ms - Date.now()
  if (diff <= 0) return 'overdue'
  if (diff < 3600000) return `in ${Math.round(diff / 60000)}m`
  if (diff < 86400000) return `in ${Math.round(diff / 3600000)}h`
  return `in ${Math.round(diff / 86400000)}d`
}

const STATUS_COLORS = {
  ok: '#39ff14',
  done: '#39ff14',
  skipped: '#ffd700',
  failed: '#ff3860',
  error: '#ff3860',
}

function statusColor(status) {
  return STATUS_COLORS[status] || '#888'
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

export default function CronJobDetailModal({ jobId, agentsMap, onClose, onChanged }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [actionMessage, setActionMessage] = useState(null)
  const [editing, setEditing] = useState(false)
  const [everyMinutes, setEveryMinutes] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/cron/${jobId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load job')
      setData(json)
      setError(null)
      if (json.job?.schedule?.kind === 'every') {
        setEveryMinutes(String(Math.round((json.job.schedule.everyMs || 0) / 60000)))
      }
      setMessage(json.job?.message || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    load()
  }, [load])

  const runAction = useCallback(
    async (body, successMessage) => {
      setBusy(true)
      setActionError(null)
      setActionMessage(null)
      try {
        const res = await fetch(`/api/cron/${jobId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error || 'Action failed')
        setActionMessage(successMessage)
        await load()
        onChanged?.()
      } catch (err) {
        setActionError(err.message)
      } finally {
        setBusy(false)
      }
    },
    [jobId, load, onChanged]
  )

  const handleRunNow = () => runAction({ action: 'run' }, 'Triggered — check History below in a few seconds.')
  const handleToggle = () => runAction({ action: 'toggle', enabled: !data.job.enabled }, data.job.enabled ? 'Job disabled.' : 'Job enabled.')

  const handleSaveEdit = () => {
    const patch = {}
    if (data.job.schedule?.kind === 'every') {
      const mins = parseInt(everyMinutes, 10)
      if (!mins || mins < 1) {
        setActionError('Interval must be a positive number of minutes.')
        return
      }
      patch.schedule = { ...data.job.schedule, everyMs: mins * 60000 }
    }
    if (data.job.payloadKind === 'agentTurn' || data.job.payloadKind === 'systemEvent') {
      if (!message.trim()) {
        setActionError('Message cannot be empty.')
        return
      }
      patch.payload = { kind: data.job.payloadKind, ...(data.job.payloadKind === 'agentTurn' ? { message } : { text: message }) }
    }
    runAction({ action: 'update', patch }, 'Changes saved.').then(() => setEditing(false))
  }

  if (typeof document === 'undefined') return null

  const job = data?.job
  const issues = job
    ? [
        job.state.consecutiveErrors > 0 && `${job.state.consecutiveErrors} consecutive error(s)`,
        job.state.consecutiveSkipped > 2 && `${job.state.consecutiveSkipped} consecutive skipped run(s)`,
        job.state.lastError && `Last error: ${job.state.lastError}`,
      ].filter(Boolean)
    : []

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="glass-card rounded-xl max-w-3xl w-full my-4 sm:my-8 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] overflow-y-auto"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-[#0d0d14]/95 backdrop-blur rounded-t-xl flex items-start justify-between gap-4 p-6 pb-4 border-b border-white/5">
          <div>
            <h3 className="text-white font-display font-bold text-lg flex items-center gap-2">
              {job?.name || 'Recurring Job'}
              {job && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{
                    color: job.enabled ? '#39ff14' : '#888',
                    background: (job.enabled ? '#39ff14' : '#888') + '22',
                    border: `1px solid ${(job.enabled ? '#39ff14' : '#888')}44`,
                  }}
                >
                  {job.enabled ? 'enabled' : 'disabled'}
                </span>
              )}
            </h3>
            {job && (
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-400">
                <AgentLabel agentId={job.agentId} agentsMap={agentsMap} />
                <span>·</span>
                <span className="font-mono">{job.scheduleSummary}</span>
                <span>·</span>
                <span>next {timeUntil(job.state.nextRunAtMs)}</span>
                {job.systemOwned && (
                  <span className="text-purple-400" title="Managed internally by OpenClaw; some fields may be read-only">
                    system-managed
                  </span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 pt-4 space-y-5">
          {loading && <div className="text-gray-400 text-sm">Loading…</div>}
          {error && (
            <div className="text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          {job && (
            <>
              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleRunNow}
                  disabled={busy}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-cyan-900/40 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/60 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" /> Run now
                </button>
                <button
                  onClick={handleToggle}
                  disabled={busy}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800/60 border border-gray-600/40 text-gray-300 hover:bg-gray-800 disabled:opacity-50"
                >
                  <Ban className="w-3.5 h-3.5" /> {job.enabled ? 'Disable' : 'Enable'}
                </button>
                {(job.schedule?.kind === 'every' || job.payloadKind === 'agentTurn' || job.payloadKind === 'systemEvent') && (
                  <button
                    onClick={() => setEditing((v) => !v)}
                    disabled={busy}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-purple-900/40 border border-purple-500/40 text-purple-300 hover:bg-purple-900/60 disabled:opacity-50"
                  >
                    <Pencil className="w-3.5 h-3.5" /> {editing ? 'Cancel edit' : 'Edit'}
                  </button>
                )}
                {actionMessage && <span className="text-xs text-green-400">{actionMessage}</span>}
                {actionError && <span className="text-xs text-red-400">{actionError}</span>}
              </div>

              {/* Edit form */}
              {editing && (
                <div className="bg-gray-900/50 rounded-lg p-4 space-y-3 border border-purple-500/20">
                  {job.schedule?.kind === 'every' && (
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Run every (minutes)</label>
                      <input
                        type="number"
                        min="1"
                        value={everyMinutes}
                        onChange={(e) => setEveryMinutes(e.target.value)}
                        className="bg-black/40 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 w-32"
                      />
                    </div>
                  )}
                  {(job.payloadKind === 'agentTurn' || job.payloadKind === 'systemEvent') && (
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">
                        {job.payloadKind === 'agentTurn' ? 'Prompt sent to the agent' : 'System event text'}
                      </label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={6}
                        className="bg-black/40 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 w-full font-mono"
                      />
                    </div>
                  )}
                  <button
                    onClick={handleSaveEdit}
                    disabled={busy}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-900/40 border border-green-500/40 text-green-300 hover:bg-green-900/60 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" /> Save changes
                  </button>
                </div>
              )}

              {/* Issues */}
              <div>
                <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">Issues</h4>
                {issues.length === 0 ? (
                  <div className="text-xs text-green-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Healthy — no recent errors or skips.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {issues.map((msg, i) => (
                      <div key={i} className="text-xs text-yellow-400 flex items-start gap-1.5 bg-yellow-900/10 border border-yellow-500/20 rounded px-2 py-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {msg}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Details */}
              <div>
                <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">Details</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-300">
                  {job.description && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Description:</span> {job.description}
                    </div>
                  )}
                  <div><span className="text-gray-500">Session target:</span> <span className="font-mono">{job.sessionTarget}</span></div>
                  <div><span className="text-gray-500">Wake mode:</span> {job.wakeMode}</div>
                  <div><span className="text-gray-500">Delivery:</span> {job.delivery?.mode || 'none'}{job.delivery?.channel ? ` → ${job.delivery.channel}` : ''}</div>
                  <div><span className="text-gray-500">Created:</span> {timeAgo(job.createdAtMs)}</div>
                </div>
                {job.message && (
                  <div className="mt-2 bg-black/30 border border-gray-800 rounded-lg p-2.5 text-xs text-gray-400 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                    {job.message}
                  </div>
                )}
              </div>

              {/* History */}
              <div>
                <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">Execution History</h4>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {(data.runs || []).length === 0 && <div className="text-xs text-gray-600 italic">No runs recorded yet.</div>}
                  {(data.runs || []).map((run, i) => (
                    <div key={i} className="bg-black/30 border border-gray-800 rounded-lg p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{ color: statusColor(run.status), background: statusColor(run.status) + '22', border: `1px solid ${statusColor(run.status)}44` }}
                        >
                          {run.status || 'unknown'}
                        </span>
                        <span className="text-[10px] text-gray-600">{timeAgo(run.ts)}</span>
                      </div>
                      {(run.summary || run.error) && (
                        <div className={`text-xs mt-1.5 line-clamp-3 ${run.error ? 'text-red-400' : 'text-gray-300'}`}>
                          {run.error || run.summary}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-600">
                        {run.durationMs != null && <span>{(run.durationMs / 1000).toFixed(1)}s</span>}
                        {run.model && <span>{run.model}</span>}
                        {run.usage && <span>{run.usage.input_tokens}/{run.usage.output_tokens} tok</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}
