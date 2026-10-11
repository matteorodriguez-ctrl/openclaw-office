'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'

function timeAgo(ms) {
  if (!ms) return 'never'
  const diff = Date.now() - ms
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const KIND_LABELS = {
  main: 'Main chat',
  cron: 'Scheduled job',
  subagent: 'Delegated task',
  dashboard: 'Dashboard chat',
  direct: 'Direct session',
}

function kindLabel(session) {
  return KIND_LABELS[session.kind] || session.kind || 'Session'
}

function formatTokens(n) {
  if (!n) return '0'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const STATUS_COLORS = {
  running: '#ffd700',
  done: '#39ff14',
  failed: '#ff3860',
  error: '#ff3860',
}

export default function AgentDetailModal({ agent, liveStatus, onClose }) {
  const [transcript, setTranscript] = useState(null)
  const [loadingTranscript, setLoadingTranscript] = useState(true)
  const [transcriptError, setTranscriptError] = useState(null)
  const [history, setHistory] = useState(null)
  const [historyError, setHistoryError] = useState(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [viewingKey, setViewingKey] = useState(null) // non-main session being viewed, if any
  const scrollRef = useRef(null)
  const transcriptSectionRef = useRef(null)

  // "View session transcript" links sit near the top of a tall modal while
  // the Transcript panel renders much further down — without this the click
  // silently updated state but nothing visible happened, so it looked dead.
  const viewSessionTranscript = useCallback((key) => {
    setViewingKey(key)
    requestAnimationFrame(() => {
      transcriptSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])
  const [reviewCards, setReviewCards] = useState(null)
  const [reviewCardsError, setReviewCardsError] = useState(null)
  const [feedbackByCard, setFeedbackByCard] = useState({})
  const [submittingByCard, setSubmittingByCard] = useState({})
  const [actionResultByCard, setActionResultByCard] = useState({})
  // Dashboard chat uses its own dedicated session, kept separate from the
  // agent's interactive `:main` session so heartbeat polls / Discord / other
  // channel traffic never gets interleaved with quick Q&A sent from here.
  const mainKey = `agent:${agent.id}:dashboard:office`

  const loadTranscript = useCallback(async (key) => {
    setLoadingTranscript(true)
    setTranscriptError(null)
    try {
      const res = await fetch(`/api/workboard/session?sessionKey=${encodeURIComponent(key)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load transcript')
      setTranscript(json.messages || [])
    } catch (err) {
      setTranscriptError(err.message)
    } finally {
      setLoadingTranscript(false)
    }
  }, [])

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agent.id}/history`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load history')
      setHistory(json.sessions || [])
    } catch (err) {
      setHistoryError(err.message)
    }
  }, [agent.id])

  // Cards sitting in "review" (done, awaiting sign-off) or "blocked" need an
  // actual decision — there was previously no way to act on these from the
  // Office view, only from the separate Workboard tab.
  const loadReviewCards = useCallback(async () => {
    try {
      const res = await fetch('/api/workboard')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load workboard')
      const mine = (json.cards || []).filter(
        (c) => c.agentId === agent.id && (c.status === 'review' || c.status === 'blocked')
      )
      setReviewCards(mine)
    } catch (err) {
      setReviewCardsError(err.message)
    }
  }, [agent.id])

  async function submitCardAction(cardId, action) {
    setSubmittingByCard((m) => ({ ...m, [cardId]: action }))
    setActionResultByCard((m) => ({ ...m, [cardId]: null }))
    try {
      const res = await fetch('/api/workboard/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, action, feedback: feedbackByCard[cardId] || '' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Action failed')
      setActionResultByCard((m) => ({ ...m, [cardId]: { ok: true, action } }))
      setFeedbackByCard((m) => ({ ...m, [cardId]: '' }))
      await loadReviewCards()
    } catch (err) {
      setActionResultByCard((m) => ({ ...m, [cardId]: { ok: false, error: err.message } }))
    } finally {
      setSubmittingByCard((m) => ({ ...m, [cardId]: null }))
    }
  }

  useEffect(() => {
    loadTranscript(viewingKey || mainKey)
  }, [viewingKey, mainKey, loadTranscript])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    loadReviewCards()
  }, [loadReviewCards])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [transcript])

  async function handleSend() {
    if (!draft.trim() || sending) return
    setSending(true)
    setSendError(null)
    // Switch back to the main session view if browsing history, then send.
    setViewingKey(null)
    try {
      const res = await fetch('/api/agents/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, message: draft }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to send')
      setDraft('')
      // Poll for the reply — agent turns typically take a few seconds to a few minutes.
      let attempts = 0
      const poll = setInterval(async () => {
        attempts += 1
        await loadTranscript(mainKey)
        await loadHistory()
        if (attempts >= 20) clearInterval(poll) // stop after ~2 minutes
      }, 6000)
      await loadTranscript(mainKey)
    } catch (err) {
      setSendError(err.message)
    } finally {
      setSending(false)
    }
  }

  const statusColor = { working: '#ffd700', idle: '#39ff14', error: '#ff3860' }[liveStatus?.status] || '#888'

  // Rendered through a portal into document.body: ancestors higher up the tree
  // (Framer Motion's animated wrappers, glass-card's backdrop-filter) create a
  // CSS containing block that traps `position: fixed`, clamping this modal to
  // the office panel's box instead of the real viewport. Escaping via portal
  // guarantees it always sizes against the actual viewport.
  if (typeof document === 'undefined') return null

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
              <span>{agent.emoji}</span>
              {agent.name}
              <span
                className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ color: statusColor, background: statusColor + '22', border: `1px solid ${statusColor}44` }}
              >
                {liveStatus?.status || '—'}
              </span>
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-400">
              <span>{agent.role}</span>
              {liveStatus?.model && (
                <span className="px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-500/30">
                  {liveStatus.model}
                </span>
              )}
              <span>last active {timeAgo(liveStatus?.lastActivityAt)}</span>
              {liveStatus?.totalSessions != null && (
                <span
                  className="border-b border-dotted border-gray-600 cursor-help"
                  title={
                    liveStatus.sessionBreakdown
                      ? [
                          liveStatus.sessionBreakdown.main && `${liveStatus.sessionBreakdown.main} main chat`,
                          liveStatus.sessionBreakdown.cron && `${liveStatus.sessionBreakdown.cron} scheduled cron runs`,
                          liveStatus.sessionBreakdown.subagent && `${liveStatus.sessionBreakdown.subagent} delegated subagent tasks`,
                          liveStatus.sessionBreakdown.dashboard && `${liveStatus.sessionBreakdown.dashboard} dashboard quick-chats`,
                          liveStatus.sessionBreakdown.direct && `${liveStatus.sessionBreakdown.direct} other direct sessions`,
                        ]
                          .filter(Boolean)
                          .join(', ')
                      : 'Total conversation threads recorded for this agent'
                  }
                >
                  · {liveStatus.totalSessions} sessions
                </span>
              )}
            </div>
            {liveStatus?.cronWarning && (
              <div className="text-red-400 text-xs mt-1">⚠ {liveStatus.cronWarning}</div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none flex-shrink-0">✕</button>
        </div>

        <div className="p-6 pt-4">

        {/* Needs Your Review — cards stuck awaiting a decision, with no live
            session, so they were previously invisible from this view. */}
        {reviewCards && reviewCards.length > 0 && (
          <div className="mb-4">
            <div className="text-orange-400 text-xs font-bold uppercase mb-1">Needs Your Review</div>
            <div className="space-y-3">
              {reviewCards.map((card) => (
                <div key={card.id} className="bg-black/30 border border-orange-500/30 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-gray-100 font-bold">{card.title}</div>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                      style={{
                        color: card.status === 'blocked' ? '#ff3860' : '#ff9f1c',
                        background: (card.status === 'blocked' ? '#ff3860' : '#ff9f1c') + '22',
                      }}
                    >
                      {card.status}
                    </span>
                  </div>
                  {card.notes && (
                    <div className="text-gray-400 text-xs mt-1 whitespace-pre-wrap line-clamp-4">{card.notes}</div>
                  )}
                  {card.sessionKey && (
                    <button
                      onClick={() => viewSessionTranscript(card.sessionKey)}
                      className="text-cyan-400 hover:text-cyan-200 text-xs mt-1 underline"
                    >
                      View session transcript →
                    </button>
                  )}
                  <textarea
                    value={feedbackByCard[card.id] || ''}
                    onChange={(e) => setFeedbackByCard((m) => ({ ...m, [card.id]: e.target.value }))}
                    placeholder="Optional feedback…"
                    className="w-full bg-black/30 border border-gray-800 rounded-lg p-2 mt-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 resize-y min-h-[50px]"
                  />
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <button
                      disabled={!!submittingByCard[card.id]}
                      onClick={() => submitCardAction(card.id, 'accept')}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-green-900/30 text-green-300 border border-green-500/40 hover:bg-green-900/50 disabled:opacity-50"
                    >
                      {submittingByCard[card.id] === 'accept' ? 'Accepting…' : '✅ Accept'}
                    </button>
                    <button
                      disabled={!!submittingByCard[card.id]}
                      onClick={() => submitCardAction(card.id, 'decline')}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-900/30 text-red-300 border border-red-500/40 hover:bg-red-900/50 disabled:opacity-50"
                    >
                      {submittingByCard[card.id] === 'decline' ? 'Sending back…' : '↩️ Decline / Rework'}
                    </button>
                    <button
                      disabled={!!submittingByCard[card.id] || !feedbackByCard[card.id]?.trim()}
                      onClick={() => submitCardAction(card.id, 'comment')}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-900/30 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-900/50 disabled:opacity-50"
                    >
                      {submittingByCard[card.id] === 'comment' ? 'Posting…' : '💬 Feedback Only'}
                    </button>
                  </div>
                  {actionResultByCard[card.id] && (
                    actionResultByCard[card.id].ok ? (
                      <div className="text-green-400 text-xs mt-1">
                        {actionResultByCard[card.id].action === 'accept' && 'Marked as done.'}
                        {actionResultByCard[card.id].action === 'decline' && 'Sent back for rework.'}
                        {actionResultByCard[card.id].action === 'comment' && 'Feedback posted.'}
                      </div>
                    ) : (
                      <div className="text-red-400 text-xs mt-1">⚠️ {actionResultByCard[card.id].error}</div>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {reviewCardsError && <div className="text-red-400 text-xs mb-4">⚠️ {reviewCardsError}</div>}

        {/* Task history */}
        <div className="mb-4">
          <div className="text-cyan-400 text-xs font-bold uppercase mb-1">Task History</div>
          {historyError && <div className="text-red-400 text-xs">⚠️ {historyError}</div>}
          {!history && !historyError && <div className="text-gray-500 text-sm">Loading…</div>}
          {history && history.length === 0 && <div className="text-gray-500 text-sm">No recorded sessions yet.</div>}
          {history && history.length > 0 && (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {history.map((s) => (
                <button
                  key={s.key}
                  onClick={() => viewSessionTranscript(s.isMain ? null : s.key)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-xs border transition-colors ${
                    (viewingKey || mainKey) === s.key
                      ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-100'
                      : 'bg-black/30 border-gray-800 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="uppercase tracking-wide text-[10px] text-gray-500">{kindLabel(s)}</span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      <span style={{ color: STATUS_COLORS[s.status] || '#888' }}>{s.status || 'pending'}</span>
                      <span className="text-gray-600">{timeAgo(s.lastActivityAt || s.updatedAt)}</span>
                    </span>
                  </div>
                  <div className="font-bold text-gray-100 mt-0.5">{s.description || 'Session'}</div>
                  {s.detail && s.detail !== s.description && (
                    <div className="text-gray-400 mt-1 line-clamp-2 whitespace-pre-wrap">{s.detail}</div>
                  )}
                  {s.outcome && (
                    <div className="text-green-400/80 mt-1 line-clamp-2 whitespace-pre-wrap">
                      <span className="text-gray-600">Result: </span>
                      {s.outcome}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-600">
                    {s.messageCount != null && <span>{s.messageCount} messages</span>}
                    <span>↑{formatTokens(s.inputTokens)} ↓{formatTokens(s.outputTokens)} tokens</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Transcript */}
        <div className="mb-4" ref={transcriptSectionRef}>
          <div className="text-cyan-400 text-xs font-bold uppercase mb-1 flex items-center justify-between">
            <span>
              {viewingKey ? 'Session Transcript' : 'Dashboard Chat'}{' '}
              <span className="text-gray-600 font-normal normal-case">({viewingKey || mainKey})</span>
            </span>
            {viewingKey && (
              <button onClick={() => setViewingKey(null)} className="text-gray-400 hover:text-white normal-case font-normal">
                ← back to main chat
              </button>
            )}
          </div>
          <div ref={scrollRef} className="space-y-2 max-h-72 overflow-y-auto">
            {loadingTranscript && <div className="text-gray-500 text-sm">Loading…</div>}
            {transcriptError && (
              <div className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                ⚠️ {transcriptError}
              </div>
            )}
            {transcript && transcript.length === 0 && (
              <div className="text-gray-500 text-sm">No messages yet — say hello below.</div>
            )}
            {transcript && transcript.map((msg, i) => (
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
        </div>

        {/* Send a task / question */}
        <div>
          <div className="text-cyan-400 text-xs font-bold uppercase mb-1">Give a Task or Ask a Question</div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${agent.name} directly…`}
            className="w-full bg-black/30 border border-gray-800 rounded-lg p-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 resize-y min-h-[70px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
            }}
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              disabled={sending || !draft.trim()}
              onClick={handleSend}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-900/30 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-900/50 disabled:opacity-50"
            >
              {sending ? 'Sending…' : '📨 Send'}
            </button>
            <span className="text-gray-600 text-xs">⌘/Ctrl + Enter to send</span>
          </div>
          {sendError && <div className="text-red-400 text-xs mt-2">⚠️ {sendError}</div>}
        </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}
