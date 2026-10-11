'use client'

import { motion } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'

export default function StatsCards({ initialStats }) {
  const [stats, setStats] = useState(null)
  const [cost, setCost] = useState(null)
  const [animatedStats, setAnimatedStats] = useState({
    conversations: 0,
    tokens: 0,
    cost: 0,
    savings: 0,
  })
  const [loading, setLoading] = useState(true)

  // Fetch real stats from API
  const fetchStats = useCallback(async () => {
    try {
      const [statsRes, costRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/stats/cost'),
      ])
      const data = await statsRes.json()
      const costData = await costRes.json()
      setStats(data)
      setCost(costData?.error ? null : costData)
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
      setLoading(false)
    }
  }, [])

  // Initial fetch + polling
  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Poll every 30 seconds
    return () => clearInterval(interval)
  }, [fetchStats])

  // Animate numbers when stats change
  useEffect(() => {
    if (!stats) return
    const totals = cost?.totals || { inputTokens: 0, outputTokens: 0, actualCostUsd: 0, savingsUsd: 0 }

    const target = {
      conversations: stats.today.messages || 0,
      tokens: totals.inputTokens + totals.outputTokens,
      cost: totals.actualCostUsd || 0,
      savings: Math.round(totals.savingsUsd || 0),
    }

    const duration = 1500
    const steps = 45
    const interval = duration / steps
    let step = 0

    const timer = setInterval(() => {
      step++
      const progress = step / steps
      const easeOut = 1 - Math.pow(1 - progress, 3)

      setAnimatedStats({
        conversations: Math.floor(target.conversations * easeOut),
        tokens: Math.floor(target.tokens * easeOut),
        cost: parseFloat((target.cost * easeOut).toFixed(2)),
        savings: Math.floor(target.savings * easeOut),
      })

      if (step >= steps) clearInterval(timer)
    }, interval)

    return () => clearInterval(timer)
  }, [stats, cost])

  // Show loading state
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
            <div className="w-8 h-8 bg-gray-700 rounded mb-2" />
            <div className="w-20 h-6 bg-gray-700 rounded mb-2" />
            <div className="w-16 h-3 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    )
  }

  const totals = cost?.totals || { inputTokens: 0, outputTokens: 0, actualCostUsd: 0, equivalentCostUsd: 0, savingsUsd: 0 }

  const cards = [
    {
      label: "Today's Messages",
      value: animatedStats.conversations,
      subValue: stats ? `${stats.today.tasks_completed} replies` : '',
      color: '#00f5ff',
      icon: '💬',
    },
    {
      label: 'Total Tokens',
      value: animatedStats.tokens.toLocaleString(),
      subValue: `In: ${(totals.inputTokens / 1000).toFixed(0)}K / Out: ${(totals.outputTokens / 1000).toFixed(0)}K`,
      color: '#9d4edd',
      icon: '🔢',
    },
    {
      label: 'Actual Cost (USD)',
      value: `$${animatedStats.cost.toFixed(2)}`,
      subValue: 'what you actually paid',
      color: '#ff006e',
      icon: '💰',
    },
    {
      label: 'Cost Avoided (USD)',
      value: `$${animatedStats.savings.toLocaleString()}`,
      subValue: 'vs. paid commercial API, same tokens',
      color: '#39ff14',
      icon: '📈',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Main Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => (
          <motion.div
            key={card.label}
            className="glass-card rounded-xl p-4 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            style={{
              borderColor: card.color + '44',
            }}
          >
            {/* Glow effect */}
            <div 
              className="absolute -top-10 -right-10 w-20 h-20 rounded-full opacity-20"
              style={{ background: `radial-gradient(circle, ${card.color}, transparent)` }}
            />

            {/* Icon */}
            <div className="text-2xl mb-2">{card.icon}</div>

            {/* Value */}
            <div 
              className="text-2xl font-display font-bold mb-1"
              style={{ color: card.color }}
            >
              {card.value}
            </div>

            {/* Label */}
            <div className="text-xs text-gray-400">{card.label}</div>
            
            {/* Sub Value */}
            {card.subValue && (
              <div className="text-[10px] text-gray-500 mt-1">{card.subValue}</div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Detailed Stats */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Today's Stats */}
          <motion.div
            className="glass-card rounded-xl p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-cyan-400 font-bold mb-3 flex items-center gap-2">
              <span>📅</span> Today's Activity
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-500">Messages</div>
                <div className="text-white font-bold">{stats.today.messages}</div>
              </div>
              <div>
                <div className="text-gray-500">Tasks Done</div>
                <div className="text-white font-bold">{stats.today.tasks_completed}</div>
              </div>
              <div>
                <div className="text-gray-500">Tokens Used</div>
                <div className="text-white font-bold">{(totals.inputTokens + totals.outputTokens).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500">Cost</div>
                <div className="text-white font-bold">${totals.actualCostUsd.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-500">Cost Avoided</div>
                <div className="text-green-400 font-bold">${totals.savingsUsd.toFixed(2)}</div>
              </div>
            </div>
          </motion.div>

          {/* All Time Stats */}
          <motion.div
            className="glass-card rounded-xl p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h3 className="text-purple-400 font-bold mb-3 flex items-center gap-2">
              <span>📊</span> All Time
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-500">Total Messages</div>
                <div className="text-white font-bold">{stats.allTime.messages.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500">Replies Sent</div>
                <div className="text-white font-bold">{stats.allTime.tasks_completed.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500">Input Tokens</div>
                <div className="text-white font-bold">{(totals.inputTokens / 1000000).toFixed(2)}M</div>
              </div>
              <div>
                <div className="text-gray-500">Output Tokens</div>
                <div className="text-white font-bold">{(totals.outputTokens / 1000000).toFixed(2)}M</div>
              </div>
              <div>
                <div className="text-gray-500">Total Cost</div>
                <div className="text-red-400 font-bold">${totals.actualCostUsd.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-500">Cost Avoided</div>
                <div className="text-green-400 font-bold">${totals.savingsUsd.toFixed(2)}</div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  )
}
