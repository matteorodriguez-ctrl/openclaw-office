'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Pause, Play, Loader2, AlertTriangle } from 'lucide-react'

// Global pause/resume control for all agent automation (cron heartbeats,
// soak checks, new agent dispatch). Backed by the gateway's cooperative
// suspension RPCs — see app/api/gateway/control/route.js for the full
// semantics and why state is tracked locally rather than re-queried live.
export default function PauseControl() {
  const [state, setState] = useState({ paused: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const fetchState = async () => {
    try {
      const res = await fetch('/api/gateway/control')
      const json = await res.json()
      setState(json)
    } catch (err) {
      // Non-fatal — just leave last known state on screen.
      console.error('Failed to fetch pause state:', err)
    }
  }

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleToggle = async () => {
    const action = state.paused ? 'resume' : 'pause'

    if (action === 'pause') {
      const confirmed = window.confirm(
        'Pause all agents? This stops new cron jobs, heartbeats, and agent dispatch. ' +
          'Active work finishes naturally but most dashboard data will show as unavailable until resumed.'
      )
      if (!confirmed) return
    }

    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/gateway/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (json.error) {
        setError(json.error)
      } else {
        setState(json)
      }
    } catch (err) {
      setError(err.message || 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <motion.button
        onClick={handleToggle}
        disabled={busy}
        whileHover={{ scale: busy ? 1 : 1.03 }}
        whileTap={{ scale: busy ? 1 : 0.97 }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all disabled:opacity-60 ${
          state.paused
            ? 'bg-yellow-900/30 border-yellow-500/50 text-yellow-400 hover:bg-yellow-900/50'
            : 'bg-gray-900/50 border-gray-700/50 text-gray-300 hover:bg-red-900/30 hover:border-red-500/50 hover:text-red-400'
        }`}
        title={state.paused ? 'Resume all agent automation' : 'Pause all agent automation'}
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : state.paused ? (
          <Play className="w-3.5 h-3.5" />
        ) : (
          <Pause className="w-3.5 h-3.5" />
        )}
        {state.paused ? 'Resume Agents' : 'Pause All Agents'}
      </motion.button>

      {error && (
        <span className="flex items-center gap-1 text-[11px] text-red-400">
          <AlertTriangle className="w-3 h-3" /> {error}
        </span>
      )}
    </div>
  )
}
