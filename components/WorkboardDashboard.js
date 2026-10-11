'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'

const STATUS_COLORS = {
  triage: '#888',
  backlog: '#666',
  todo: '#00f5ff',
  scheduled: '#9d4edd',
  ready: '#ffb703',
  running: '#ff9f1c',
  review: '#f72585',
  blocked: '#ff006e',
  done: '#39ff14',
}

function CardDetailModal({ card, onClose, onActionComplete }) {
  const [transcript, setTranscript] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(null) // 'accept' | 'decline' | 'comment' | null
  const [actionError, setActionError] = useState(null)
  const [actionDone, setActionDone] = useState(null)

  const comments = card.metadata?.comments || []

  const canReview = ['review', 'running', 'ready', 'todo', 'blocked'].includes(card.status)

  async function submitAction(action) {
    setSubmitting(action)
    setActionError(null)
    try {
      const res = await fetch('/api/workboard/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: card.id, action, feedback }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Action failed')
      setActionDone(action)
      setFeedback('')
      onActionComplete?.()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setSubmitting(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!card.sessionKey) {
        setLoading(false)
        setError('This card has no linked agent session yet (not dispatched).')
        return
      }
      try {
        const res = await fetch(`/api/workboard/session?sessionKey=${encodeURIComponent(card.sessionKey)}`)
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(json.error || 'Failed to load session transcript')
        } else {
          setTranscript(json.messages || [])
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [card.sessionKey])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="glass-card rounded-xl p-6 max-w-3xl w-full max-h-[85vh] overflow-y-auto"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-white font-display font-bold text-lg">{card.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              {card.agentId && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-500/30">
                  {card.agentId}
                </span>
              )}
              <span
                className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{
                  color: STATUS_COLORS[card.status] || '#888',
                  background: (STATUS_COLORS[card.status] || '#888') + '22',
                  border: `1px solid ${STATUS_COLORS[card.status] || '#888'}44`,
                }}
              >
                {card.status}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {card.notes && (
          <div className="mb-4">
            <div className="text-cyan-400 text-xs font-bold uppercase mb-1">Task Notes</div>
            <div className="text-gray-300 text-sm whitespace-pre-wrap bg-black/30 rounded-lg p-3 border border-gray-800">
              {card.notes}
            </div>
          </div>
        )}

        {comments.length > 0 && (
          <div className="mb-4">
            <div className="text-cyan-400 text-xs font-bold uppercase mb-1">Feedback History</div>
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="text-gray-300 text-sm bg-black/30 rounded-lg p-3 border border-gray-800">
                  {c.body}
                  {c.createdAt && (
                    <div className="text-gray-600 text-xs mt-1">{new Date(c.createdAt).toLocaleString()}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {canReview && (
          <div className="mb-4">
            <div className="text-cyan-400 text-xs font-bold uppercase mb-1">Review &amp; Feedback</div>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Optional feedback for the agent or for the record…"
              className="w-full bg-black/30 border border-gray-800 rounded-lg p-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 resize-y min-h-[70px]"
            />
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button
                disabled={!!submitting}
                onClick={() => submitAction('accept')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-900/30 text-green-300 border border-green-500/40 hover:bg-green-900/50 disabled:opacity-50"
              >
                {submitting === 'accept' ? 'Accepting…' : '✅ Accept'}
              </button>
              <button
                disabled={!!submitting}
                onClick={() => submitAction('decline')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-900/30 text-red-300 border border-red-500/40 hover:bg-red-900/50 disabled:opacity-50"
              >
                {submitting === 'decline' ? 'Sending back…' : '↩️ Decline / Rework'}
              </button>
              <button
                disabled={!!submitting || !feedback.trim()}
                onClick={() => submitAction('comment')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-900/30 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-900/50 disabled:opacity-50"
              >
                {submitting === 'comment' ? 'Posting…' : '💬 Add Feedback Only'}
              </button>
            </div>
            {actionError && <div className="text-red-400 text-xs mt-2">⚠️ {actionError}</div>}
            {actionDone && !actionError && (
              <div className="text-green-400 text-xs mt-2">
                {actionDone === 'accept' && 'Marked as done.'}
                {actionDone === 'decline' && 'Sent back to Todo for rework.'}
                {actionDone === 'comment' && 'Feedback posted.'}
              </div>
            )}
          </div>
        )}

        <div>
          <div className="text-cyan-400 text-xs font-bold uppercase mb-1">
            Agent Transcript {card.sessionKey && <span className="text-gray-600 font-normal normal-case">({card.sessionKey})</span>}
          </div>

          {loading && <div className="text-gray-500 text-sm">Loading transcript…</div>}
          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              ⚠️ {error}
            </div>
          )}

          {transcript && (
            <div className="space-y-2">
              {transcript.length === 0 && (
                <div className="text-gray-500 text-sm">No messages recorded yet.</div>
              )}
              {transcript.map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-3 text-sm border ${
                    msg.isError
                      ? 'bg-red-900/20 border-red-500/30 text-red-300'
                      : msg.role === 'user'
                      ? 'bg-cyan-900/10 border-cyan-500/20 text-cyan-100'
                      : msg.role === 'assistant'
                      ? 'bg-orange-900/10 border-orange-500/20 text-orange-100'
                      : 'bg-black/30 border-gray-800 text-gray-400'
                  }`}
                >
                  <div className="text-xs font-bold uppercase mb-1 opacity-60">{msg.role}</div>
                  <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function WorkboardDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCard, setSelectedCard] = useState(null)

  const fetchBoard = useCallback(async () => {
    try {
      const response = await fetch('/api/workboard')
      const json = await response.json()
      if (!response.ok) {
        setError(json.error || 'Workboard unavailable')
      } else {
        setError(null)
      }
      setData(json)
      setLoading(false)
    } catch (err) {
      console.error('Failed to fetch workboard:', err)
      setError(err.message)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBoard()
    const interval = setInterval(fetchBoard, 10000) // Poll every 10s — tasks can be long-running
    return () => clearInterval(interval)
  }, [fetchBoard])

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-4 animate-pulse">
        <div className="w-40 h-6 bg-gray-700 rounded mb-4" />
        <div className="w-full h-24 bg-gray-800 rounded" />
      </div>
    )
  }

  const cards = data?.cards || []
  const stats = data?.stats

  return (
    <div className="space-y-6">
      {error && (
        <div className="glass-card rounded-xl p-4 border border-red-500/50">
          <div className="text-red-400 text-sm">⚠️ {error}</div>
          <div className="text-gray-500 text-xs mt-1">
            Make sure the Workboard plugin is enabled on the gateway.
          </div>
        </div>
      )}

      {/* Summary */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            className="glass-card rounded-xl p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-2xl mb-1">📋</div>
            <div className="text-2xl font-display font-bold text-cyan-400">{stats.total}</div>
            <div className="text-xs text-gray-400">Total Cards</div>
          </motion.div>
          <motion.div
            className="glass-card rounded-xl p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="text-2xl mb-1">⚡</div>
            <div className="text-2xl font-display font-bold text-orange-400">{stats.active}</div>
            <div className="text-xs text-gray-400">Active</div>
          </motion.div>
          <motion.div
            className="glass-card rounded-xl p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-2xl mb-1">✅</div>
            <div className="text-2xl font-display font-bold text-green-400">
              {stats.byStatus?.done || 0}
            </div>
            <div className="text-xs text-gray-400">Done</div>
          </motion.div>
          <motion.div
            className="glass-card rounded-xl p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="text-2xl mb-1">📦</div>
            <div className="text-2xl font-display font-bold text-gray-400">{stats.archived}</div>
            <div className="text-xs text-gray-400">Archived</div>
          </motion.div>
        </div>
      )}

      {/* Card list */}
      <motion.div
        className="glass-card rounded-xl p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h3 className="text-cyan-400 font-bold mb-3 flex items-center gap-2">
          <span>🗂️</span> Cards {cards.length > 0 && `(${cards.length})`}
        </h3>

        {cards.length === 0 && !error && (
          <div className="text-gray-500 text-sm">
            No cards yet. Create one with{' '}
            <code className="text-cyan-400">openclaw workboard create</code>
          </div>
        )}

        <div className="space-y-2">
          {cards.map((card) => (
            <div
              key={card.id}
              onClick={() => setSelectedCard(card)}
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-black/30 border border-gray-800 cursor-pointer hover:border-cyan-500/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="text-white text-sm font-medium truncate">{card.title}</div>
                {card.notes && (
                  <div className="text-gray-500 text-xs truncate">{card.notes}</div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {card.agentId && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-500/30">
                    {card.agentId}
                  </span>
                )}
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{
                    color: STATUS_COLORS[card.status] || '#888',
                    background: (STATUS_COLORS[card.status] || '#888') + '22',
                    border: `1px solid ${STATUS_COLORS[card.status] || '#888'}44`,
                  }}
                >
                  {card.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-gray-600 text-xs mt-3">Click a card to view full details & agent transcript</div>
      </motion.div>

      <AnimatePresence>
        {selectedCard && (
          <CardDetailModal
            card={selectedCard}
            onClose={() => setSelectedCard(null)}
            onActionComplete={fetchBoard}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
