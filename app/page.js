'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Users, DollarSign, Activity, Database, ClipboardList, Radio, ShieldCheck, HelpCircle, ScrollText, Server, Hammer } from 'lucide-react'
import IsometricOffice from '../components/IsometricOffice'
import ActivityLog from '../components/ActivityLog'
import StatsCards from '../components/StatsCards'
import TeamDashboard from '../components/TeamDashboard'
import DatabaseDashboard from '../components/DatabaseDashboard'
import CostDashboard from '../components/CostDashboard'
import WorkboardDashboard from '../components/WorkboardDashboard'
import ActivityDashboard from '../components/ActivityDashboard'
import ApprovalsDashboard from '../components/ApprovalsDashboard'
import QuestionsDashboard from '../components/QuestionsDashboard'
import AuditDashboard from '../components/AuditDashboard'
import ArchitectureDashboard from '../components/ArchitectureDashboard'
import ConstructionArea from '../components/ConstructionArea'
import PauseControl from '../components/PauseControl'

const tabs = [
  { id: 'office', label: 'Main Office', icon: Building2 },
  { id: 'stats', label: 'Interaction Stats', icon: Activity },
  { id: 'team', label: 'Agent Thoughts', icon: Users },
  { id: 'cost', label: 'Cost Savings', icon: DollarSign },
  { id: 'approvals', label: 'Approvals', icon: ShieldCheck },
  { id: 'questions', label: 'Decisions', icon: HelpCircle },
  { id: 'database', label: 'Database', icon: Database },
  { id: 'workboard', label: 'Workboard', icon: ClipboardList },
  { id: 'activity', label: 'All Activity', icon: Radio },
  { id: 'audit', label: 'Audit Trail', icon: ScrollText },
  { id: 'architecture', label: 'Architecture', icon: Server },
  { id: 'construction', label: 'Construction Area', icon: Hammer },
]

export default function Home() {
  const [activeTab, setActiveTab] = useState('office')
  const [headerStats, setHeaderStats] = useState({
    tasks: 0,
    tokens: 0,
    savings: 0,
  })
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [pendingQuestions, setPendingQuestions] = useState(0)
  const [pauseState, setPauseState] = useState({ paused: false })

  // Poll the locally-persisted pause state so the banner stays accurate
  // even while the gateway itself is unreachable for other reads during
  // an active suspension.
  useEffect(() => {
    const fetchPauseState = async () => {
      try {
        const res = await fetch('/api/gateway/control')
        const json = await res.json()
        setPauseState(json)
      } catch (error) {
        console.error('Failed to fetch pause state:', error)
      }
    }
    fetchPauseState()
    const interval = setInterval(fetchPauseState, 10000)
    return () => clearInterval(interval)
  }, [])

  // Pending approvals can mean a real agent is blocked right now waiting on
  // human sign-off — poll independently of the slower header stats so the
  // nav badge stays current.
  useEffect(() => {
    const fetchApprovalCount = async () => {
      try {
        const res = await fetch('/api/approvals')
        const json = await res.json()
        setPendingApprovals(json.approvals?.length || 0)
      } catch (error) {
        console.error('Failed to fetch approval count:', error)
      }
    }
    fetchApprovalCount()
    const interval = setInterval(fetchApprovalCount, 5000)
    return () => clearInterval(interval)
  }, [])

  // Pending decisions mean an agent has paused a task waiting on a human
  // judgment call — poll independently so the nav badge stays current.
  useEffect(() => {
    const fetchQuestionCount = async () => {
      try {
        const res = await fetch('/api/questions')
        const json = await res.json()
        setPendingQuestions(json.questions?.length || 0)
      } catch (error) {
        console.error('Failed to fetch question count:', error)
      }
    }
    fetchQuestionCount()
    const interval = setInterval(fetchQuestionCount, 5000)
    return () => clearInterval(interval)
  }, [])
  
  // Fetch stats for header — tokens/savings from the real gateway-backed
  // cost comparison (lib/cost.js), tasks_completed from the legacy DB
  // counter (still a rough proxy, informational only).
  useEffect(() => {
    const fetchHeaderStats = async () => {
      try {
        const [statsRes, costRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/stats/cost'),
        ])
        const data = await statsRes.json()
        const costData = await costRes.json()
        const totals = costData?.totals || {}
        setHeaderStats({
          tasks: data.allTime?.tasks_completed || 0,
          tokens: (totals.inputTokens || 0) + (totals.outputTokens || 0),
          savings: Math.round(totals.savingsUsd || 0),
        })
      } catch (error) {
        console.error('Failed to fetch header stats:', error)
      }
    }
    
    fetchHeaderStats()
    const interval = setInterval(fetchHeaderStats, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <main className="min-h-screen p-4 lg:p-6 relative">
      {/* Header */}
      <motion.header 
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <motion.div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl gradient-border"
              whileHover={{ scale: 1.05 }}
              style={{ background: 'linear-gradient(135deg, #0a0a1a, #1a1a3a)' }}
            >
              🏢
            </motion.div>
            <div>
              <h1 className="font-display text-2xl font-bold">
                <span className="neon-cyan">OpenClaw</span>
                <span className="text-white mx-2">IT</span>
              </h1>
              <p className="text-xs text-gray-500">AI Office Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-900/30 border border-green-500/50">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-400 font-bold">LIVE</span>
          </div>

          <PauseControl />
        </div>

        {/* Quick stats */}
        <div className="hidden lg:flex items-center gap-6 text-sm">
          <div>
            <span className="text-gray-500">Tasks: </span>
            <span className="text-cyan-400 font-bold">{headerStats.tasks}</span>
          </div>
          <div>
            <span className="text-gray-500">Tokens: </span>
            <span className="text-purple-400 font-bold">{(headerStats.tokens / 1000000).toFixed(2)}M</span>
          </div>
          <div>
            <span className="text-gray-500">Saved: </span>
            <span className="text-green-400 font-bold">${headerStats.savings.toLocaleString()}</span>
          </div>
        </div>
      </motion.header>

      {/* Paused banner — shown whenever the dashboard's locally-tracked
          pause state says agents are suspended. Most other panels will
          show stale/errored data while this is true, by design. */}
      {pauseState.paused && (
        <motion.div
          className="flex items-center gap-3 mb-6 px-4 py-3 rounded-lg bg-yellow-900/20 border border-yellow-500/40 text-yellow-300 text-sm"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-lg">⏸️</span>
          <span>
            <strong>Agents are paused.</strong> New cron jobs, heartbeats, and agent dispatch are
            stopped. Active work is finishing naturally. Some dashboard data may show as
            unavailable until you click &quot;Resume Agents&quot;.
          </span>
        </motion.div>
      )}

      {/* Tab Navigation */}
      <motion.nav 
        className="flex flex-wrap gap-2 mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-cyan-900/50 border border-cyan-500/50 text-cyan-400'
                : 'bg-gray-900/50 border border-gray-700/50 text-gray-400 hover:text-white'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.id === 'approvals' && pendingApprovals > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                {pendingApprovals}
              </span>
            )}
            {tab.id === 'questions' && pendingQuestions > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-yellow-500 text-black text-[10px] font-bold animate-pulse">
                {pendingQuestions}
              </span>
            )}
          </motion.button>
        ))}
      </motion.nav>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'office' && (
          <motion.div
            key="office"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 xl:grid-cols-3 gap-6"
          >
            {/* Office View */}
            <div className="xl:col-span-2">
              <div className="glass-card rounded-xl p-4 h-auto">
                <IsometricOffice />
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Activity Log */}
              <ActivityLog />
            </div>
          </motion.div>
        )}

        {activeTab === 'stats' && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <StatsCards />
          </motion.div>
        )}

        {activeTab === 'team' && (
          <motion.div
            key="team"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <TeamDashboard />
          </motion.div>
        )}

        {activeTab === 'cost' && (
          <motion.div
            key="cost"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <CostDashboard />
          </motion.div>
        )}

        {activeTab === 'approvals' && (
          <motion.div
            key="approvals"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <ApprovalsDashboard />
          </motion.div>
        )}

        {activeTab === 'questions' && (
          <motion.div
            key="questions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <QuestionsDashboard />
          </motion.div>
        )}

        {activeTab === 'database' && (
          <motion.div
            key="database"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <DatabaseDashboard />
          </motion.div>
        )}

        {activeTab === 'workboard' && (
          <motion.div
            key="workboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <WorkboardDashboard />
          </motion.div>
        )}

        {activeTab === 'activity' && (
          <motion.div
            key="activity"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <ActivityDashboard />
          </motion.div>
        )}

        {activeTab === 'audit' && (
          <motion.div
            key="audit"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <AuditDashboard />
          </motion.div>
        )}

        {activeTab === 'architecture' && (
          <motion.div
            key="architecture"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <ArchitectureDashboard />
          </motion.div>
        )}

        {activeTab === 'construction' && (
          <motion.div
            key="construction"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <ConstructionArea />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <motion.footer 
        className="mt-8 text-center text-xs text-gray-600"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <p>OpenClaw © {new Date().getFullYear()} • AI Office Dashboard • Powered by OpenClaw</p>
      </motion.footer>
    </main>
  )
}
