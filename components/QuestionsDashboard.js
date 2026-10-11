'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'

function timeLeft(expiresAtMs) {
  if (!expiresAtMs) return null
  const diff = expiresAtMs - Date.now()
  if (diff <= 0) return 'expired'
  const mins = Math.round(diff / 60000)
  return mins < 1 ? '<1m left' : `${mins}m left`
}

function SubQuestion({ sub, answers, onPick, onFreeText, disabled }) {
  const picked = answers[sub.questionId] || []

  function toggle(label) {
    if (sub.multiSelect) {
      const next = picked.includes(label) ? picked.filter((l) => l !== label) : [...picked, label]
      onPick(sub.questionId, next)
    } else {
      onPick(sub.questionId, [label])
    }
  }

  return (
    <div className="space-y-2">
      {sub.header && <div className="text-xs font-bold text-cyan-300">{sub.header}</div>}
      <div className="text-white text-sm whitespace-pre-wrap break-words">{sub.question}</div>
      <div className="flex flex-wrap gap-2">
        {sub.options.map((opt) => (
          <button
            key={opt.label}
            disabled={disabled}
            onClick={() => toggle(opt.label)}
            title={opt.description}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border disabled:opacity-50 ${
              picked.includes(opt.label)
                ? 'bg-cyan-700/40 text-cyan-200 border-cyan-400/60'
                : 'bg-gray-900/40 text-gray-300 border-gray-600/50 hover:bg-gray-800/60'
            }`}
          >
            {opt.label}
          </button>
        ))}
        {sub.isOther && (
          <input
            type="text"
            disabled={disabled}
            placeholder="Other…"
            defaultValue={picked[0] && !sub.options.some((o) => o.label === picked[0]) ? picked[0] : ''}
            onBlur={(e) => e.target.value && onFreeText(sub.questionId, [e.target.value])}
            className="px-3 py-1.5 rounded-lg text-xs bg-black/30 border border-gray-600/50 text-white placeholder-gray-500"
          />
        )}
      </div>
    </div>
  )
}

function QuestionCard({ record, onResolve, resolving }) {
  const [answers, setAnswers] = useState({})

  function pick(questionId, labels) {
    setAnswers((prev) => ({ ...prev, [questionId]: labels }))
  }

  const allAnswered = record.questions.every((q) => (answers[q.questionId] || []).length > 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="rounded-lg bg-black/30 border border-yellow-500/30 p-4 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-300 border border-yellow-500/30">
            ❓ Decision Needed
          </span>
          {record.agentId && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-900/30 text-cyan-300 border border-cyan-500/30">
              {record.agentId}
            </span>
          )}
        </div>
        <div className="text-right shrink-0 text-xs text-gray-500">{timeLeft(record.expiresAtMs)}</div>
      </div>

      <div className="space-y-4">
        {record.questions.map((sub) => (
          <SubQuestion
            key={sub.questionId}
            sub={sub}
            answers={answers}
            onPick={pick}
            onFreeText={pick}
            disabled={!!resolving}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          disabled={!allAnswered || !!resolving}
          onClick={() => onResolve(record, answers)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-900/30 text-green-300 border border-green-500/40 hover:bg-green-900/50 disabled:opacity-40"
        >
          {resolving === 'answer' ? 'Submitting…' : '✅ Submit Answer'}
        </button>
        <button
          disabled={!!resolving}
          onClick={() => onResolve(record, null, true)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-900/30 text-red-300 border border-red-500/40 hover:bg-red-900/50 disabled:opacity-50"
        >
          {resolving === 'cancel' ? 'Cancelling…' : '🚫 Cancel'}
        </button>
      </div>
    </motion.div>
  )
}

export default function QuestionsDashboard() {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [resolvingId, setResolvingId] = useState(null)
  const [actionError, setActionError] = useState(null)

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch('/api/questions')
      const json = await res.json()
      if (json.error) setError(json.error)
      else setError(null)
      setQuestions(json.questions || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQuestions()
    // An agent is paused mid-task waiting on this — poll aggressively.
    const interval = setInterval(fetchQuestions, 5000)
    return () => clearInterval(interval)
  }, [fetchQuestions])

  async function resolve(record, answers, cancel) {
    setResolvingId(`${record.id}:${cancel ? 'cancel' : 'answer'}`)
    setActionError(null)
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cancel ? { id: record.id, cancel: true } : { id: record.id, answers }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to resolve question')
      setQuestions((prev) => prev.filter((q) => q.id !== record.id))
    } catch (err) {
      setActionError(err.message)
    } finally {
      setResolvingId(null)
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
          <span>❓</span> Pending Decisions {questions.length > 0 && `(${questions.length})`}
        </h3>
        <div className="text-gray-500 text-xs mb-3">
          Judgment calls an agent has paused a task on and is waiting for your answer — distinct from exec/plugin
          approvals, which gate actions rather than decisions.
        </div>

        {questions.length === 0 && !error && (
          <div className="text-gray-500 text-sm py-4 text-center">
            <span className="text-2xl block mb-2">✅</span>
            No agents are waiting on a decision right now.
          </div>
        )}

        <div className="space-y-3">
          <AnimatePresence>
            {questions.map((record) => (
              <QuestionCard
                key={record.id}
                record={record}
                resolving={resolvingId?.startsWith(record.id) ? resolvingId.split(':')[1] : null}
                onResolve={resolve}
              />
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
