'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'

const KIND_LABEL = { exec: '⚙️ Exec Command', plugin: '🧩 Plugin Action' }
const SEVERITY_COLOR = { critical: '#ff006e', warning: '#ffb703', info: '#00f5ff' }

function timeLeft(expiresAtMs) {
  if (!expiresAtMs) return null
  const diff = expiresAtMs - Date.now()
  if (diff <= 0) return 'expired'
  const mins = Math.round(diff / 60000)
  return mins < 1 ? '<1m left' : `${mins}m left`
}

function ApprovalCard({ approval, onDecide, deciding }) {
  const color = SEVERITY_COLOR[approval.severity] || '#888'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="rounded-lg bg-black/30 border p-4 space-y-3"
      style={{ borderColor: `${color}44` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-500/30">
              {KIND_LABEL[approval.kind] || approval.kind}
            </span>
            {approval.agentId && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-900/30 text-cyan-300 border border-cyan-500/30">
                {approval.agentId}
              </span>
            )}
            {approval.severity && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ color, background: `${color}22`, border: `1px solid ${color}44` }}
              >
                {approval.severity}
              </span>
            )}
          </div>
          <div className="text-white text-sm font-mono mt-2 whitespace-pre-wrap break-words">{approval.summary}</div>
          {approval.detail && (
            <div className="text-gray-400 text-xs mt-1 whitespace-pre-wrap break-words">{approval.detail}</div>
          )}
        </div>
        <div className="text-right shrink-0 text-xs text-gray-500">
          <div>{timeLeft(approval.expiresAtMs)}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          disabled={!!deciding}
          onClick={() => onDecide(approval, 'allow-once')}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-900/30 text-green-300 border border-green-500/40 hover:bg-green-900/50 disabled:opacity-50"
        >
          {deciding === 'allow-once' ? 'Approving…' : '✅ Allow Once'}
        </button>
        <button
          disabled={!!deciding}
          onClick={() => onDecide(approval, 'allow-always')}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-900/30 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-900/50 disabled:opacity-50"
        >
          {deciding === 'allow-always' ? 'Approving…' : '♾️ Always Allow'}
        </button>
        <button
          disabled={!!deciding}
          onClick={() => onDecide(approval, 'deny')}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-900/30 text-red-300 border border-red-500/40 hover:bg-red-900/50 disabled:opacity-50"
        >
          {deciding === 'deny' ? 'Denying…' : '🚫 Deny'}
        </button>
      </div>
    </motion.div>
  )
}

export default function ApprovalsDashboard() {
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [decidingId, setDecidingId] = useState(null)
  const [actionError, setActionError] = useState(null)

  const fetchApprovals = useCallback(async () => {
    try {
      const res = await fetch('/api/approvals')
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Approvals unavailable')
      else setError(null)
      setApprovals(json.approvals || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchApprovals()
    // Pending approvals can block an agent right now — poll aggressively.
    const interval = setInterval(fetchApprovals, 5000)
    return () => clearInterval(interval)
  }, [fetchApprovals])

  async function decide(approval, decision) {
    setDecidingId(`${approval.id}:${decision}`)
    setActionError(null)
    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: approval.id, kind: approval.kind, decision }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Decision failed')
      setApprovals((prev) => prev.filter((a) => a.id !== approval.id))
    } catch (err) {
      setActionError(err.message)
    } finally {
      setDecidingId(null)
    }
  }

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-4 animate-pulse">
        <div className="w-40 h-6 bg-gray-700 rounded mb-4" />
        <div className="w-full h-24 bg-gray-800 rounded" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="glass-card rounded-xl p-4 border border-red-500/50">
          <div className="text-red-400 text-sm">⚠️ {error}</div>
        </div>
      )}

      {actionError && (
        <div className="glass-card rounded-xl p-3 border border-red-500/50">
          <div className="text-red-400 text-xs">⚠️ {actionError}</div>
        </div>
      )}

      <motion.div className="glass-card rounded-xl p-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h3 className="text-cyan-400 font-bold mb-1 flex items-center gap-2">
          <span>🛂</span> Pending Approvals {approvals.length > 0 && `(${approvals.length})`}
        </h3>
        <div className="text-gray-500 text-xs mb-3">
          Exec commands and plugin actions an agent is blocked on until you approve or deny them. Covers the
          <code className="text-cyan-400 mx-1">exec</code> and <code className="text-cyan-400 mx-1">plugin</code>
          approval kinds — not a dispatch/review queue (see Workboard for that).
        </div>

        {approvals.length === 0 && !error && (
          <div className="text-gray-500 text-sm py-4 text-center">
            <span className="text-2xl block mb-2">✅</span>
            No agents are waiting on an approval right now.
          </div>
        )}

        <div className="space-y-3">
          <AnimatePresence>
            {approvals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                deciding={decidingId?.startsWith(approval.id) ? decidingId.split(':')[1] : null}
                onDecide={decide}
              />
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
