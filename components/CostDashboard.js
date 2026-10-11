'use client'

import { motion } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { TrendingUp, DollarSign, Cpu, ArrowUpRight, Info } from 'lucide-react'

function useAgentMap() {
  const [agentMap, setAgentMap] = useState({})
  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(data => {
      const map = {}
      for (const a of (data.agents || [])) map[a.id] = a
      setAgentMap(map)
    }).catch(() => {})
  }, [])
  return agentMap
}

function formatUSD(value) {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`
  return `$${value.toFixed(2)}`
}

function formatTokens(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
  return `${value}`
}

// Animated number component
function AnimatedNumber({ target, format = 'number', duration = 1500 }) {
  const [current, setCurrent] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!target) { setCurrent(0); return }
    const steps = 60
    let step = 0
    const timer = setInterval(() => {
      step++
      const progress = step / steps
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setCurrent(target * easeOut)
      if (step >= steps) clearInterval(timer)
    }, duration / steps)
    return () => clearInterval(timer)
  }, [target, duration])

  if (format === 'usd') return formatUSD(current)
  if (format === 'tokens') return formatTokens(current)
  return Math.floor(current).toLocaleString()
}

export default function CostDashboard() {
  const agentMap = useAgentMap()
  const [cost, setCost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/stats/cost')
        if (!res.ok) throw new Error('Failed to fetch cost comparison')
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setCost(data)
      } catch (err) {
        console.error('CostDashboard fetch error:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const totals = cost?.totals || { inputTokens: 0, outputTokens: 0, actualCostUsd: 0, equivalentCostUsd: 0, savingsUsd: 0 }
  const totalTokens = totals.inputTokens + totals.outputTokens
  const perAgent = cost?.perAgent || []

  const statCards = [
    {
      label: 'Savings vs. Paid API',
      value: totals.savingsUsd,
      format: 'usd',
      icon: DollarSign,
      color: '#39ff14',
      subtitle: `vs $${totals.actualCostUsd.toFixed(2)} actually paid`,
    },
    {
      label: 'Commercial-Equivalent Cost',
      value: totals.equivalentCostUsd,
      format: 'usd',
      icon: TrendingUp,
      color: '#00f5ff',
      subtitle: cost?.referenceModel || 'reference pricing',
    },
    {
      label: 'Tokens Used',
      value: totalTokens,
      format: 'tokens',
      icon: Cpu,
      color: '#ff006e',
      subtitle: `${formatTokens(totals.inputTokens)} in / ${formatTokens(totals.outputTokens)} out`,
    },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <DollarSign className="w-6 h-6 text-green-500" />
          <h2 className="font-display text-xl text-cyber-cyan">Cost Savings</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-4 text-center animate-pulse">
              <div className="w-6 h-6 mx-auto mb-2 rounded bg-gray-700" />
              <div className="h-8 w-20 mx-auto mb-1 rounded bg-gray-700" />
              <div className="h-3 w-16 mx-auto rounded bg-gray-800" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <DollarSign className="w-6 h-6 text-green-500" />
        <h2 className="font-display text-xl text-cyber-cyan">Cost Savings</h2>
        {totals.savingsUsd > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800/50">
            <ArrowUpRight className="w-3 h-3 inline mr-0.5" />
            {totals.actualCostUsd > 0
              ? `${((totals.savingsUsd / totals.actualCostUsd) * 100).toFixed(0)}% cheaper`
              : '100% free'}
          </span>
        )}
      </div>

      {/* Methodology note */}
      <div className="glass-card rounded-xl p-3 border border-cyan-900/30 flex items-start gap-2">
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-400">
          Based on real token usage from the gateway, priced at what each agent's actual
          model costs (free for local/OpenRouter free-tier models) vs. what the same
          volume would cost on {cost?.referenceModel || 'a mainstream paid API'}. This is a
          token-volume price reference only — not a claim that the free/local models match
          that API's output quality or capability.
        </p>
      </div>

      {error && (
        <div className="glass-card rounded-xl p-3 border border-red-900/50 text-red-400 text-sm">
          ⚠️ Error loading data: {error}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((card, index) => (
          <motion.div
            key={card.label}
            className="glass-card rounded-xl p-4 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <card.icon
              className="w-6 h-6 mx-auto mb-2 opacity-50"
              style={{ color: card.color }}
            />
            <div
              className="text-2xl font-display font-bold mb-1"
              style={{ color: card.color }}
            >
              <AnimatedNumber target={card.value} format={card.format} />
            </div>
            <div className="text-xs text-gray-400">{card.label}</div>
            {card.subtitle && (
              <div className="text-[10px] text-gray-500 mt-1">{card.subtitle}</div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Per-agent breakdown */}
      <motion.div
        className="glass-card rounded-xl overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-purple-900/30">
          <TrendingUp className="w-4 h-4 text-yellow-500" />
          <h3 className="font-display text-sm text-cyber-cyan">Per-Agent Breakdown</h3>
          <span className="text-[10px] text-gray-500 ml-auto">real token data from gateway</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-gray-500 font-normal">Agent</th>
                <th className="px-4 py-3 text-left text-gray-500 font-normal">Model</th>
                <th className="px-4 py-3 text-center text-gray-500 font-normal">Tokens</th>
                <th className="px-4 py-3 text-center text-gray-500 font-normal">Actual Cost</th>
                <th className="px-4 py-3 text-center text-gray-500 font-normal">Equivalent Cost</th>
                <th className="px-4 py-3 text-center text-gray-500 font-normal">Savings</th>
              </tr>
            </thead>
            <tbody>
              {perAgent.map((row, index) => {
                const agentConfig = agentMap[row.id] || { name: row.id, emoji: '🤖', color: '#888', role: 'Agent' }
                const tokens = row.inputTokens + row.outputTokens
                return (
                  <motion.tr
                    key={row.id}
                    className="border-b border-gray-800/50 hover:bg-white/5 transition-colors"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{agentConfig.emoji}</span>
                        <div>
                          <div className="font-bold" style={{ color: agentConfig.color }}>
                            {agentConfig.name}
                          </div>
                          <div className="text-[10px] text-gray-500">{agentConfig.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {row.model || '—'}
                      <div className="text-[10px] text-gray-600">{row.modelLabel}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-300">
                      {formatTokens(tokens)}
                    </td>
                    <td className="px-4 py-3 text-center text-cyan-400">
                      ${row.actualCostUsd.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-center text-purple-400">
                      ${row.equivalentCostUsd.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-green-400 font-bold">
                        ${row.savingsUsd.toFixed(2)}
                      </span>
                    </td>
                  </motion.tr>
                )
              })}
              {perAgent.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">No agent usage data yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}
