'use client'

import { motion } from 'framer-motion'
import { Cpu, Server, GitBranch, MessageSquare, ShieldCheck } from 'lucide-react'

const MODEL_TIERS = [
  { name: 'qwen2.5:14b', size: '9.0GB', role: 'Primary — main agent coding/reasoning', status: 'Active (CPU, 100%, 16k ctx)' },
  { name: 'qwen2.5-coder:14b', size: '9.0GB', role: 'Staged — best fit for GDScript edits', status: 'Staged, moves to GPU' },
  { name: 'qwen2.5:7b', size: '4.7GB', role: 'Fast triage / survey tasks', status: 'Staged, moves to GPU' },
  { name: 'qwen3:4b / qwen2.5:3b / llama3.2:3b', size: '~2GB ea', role: 'Heartbeat / soak-check tier', status: 'Staged, lightweight GPU/CPU' },
  { name: 'OpenRouter free (nemotron-3-ultra, laguna-s-2.1, dots-3)', size: 'cloud', role: 'agent1 planning + fallback', status: 'Active (cloud)' },
]

export default function ArchitectureDashboard() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-black/30 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <Server className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-gray-100">Studio Architecture</h2>
        </div>
        <p className="text-sm text-gray-400">
          How this server runs as an AI game-development studio: you direct via Discord / OpenClaw Office,
          agents plan and build against the <span className="text-gray-200 font-semibold">tower-defense</span> Godot
          project, and an <span className="text-gray-200 font-semibold">NVIDIA Tesla T4 (16GB VRAM)</span> is incoming
          to move coding models onto GPU.
        </p>
      </div>

      {/* Flow diagram */}
      <div className="bg-black/30 border border-gray-800 rounded-xl p-5 overflow-x-auto">
        <pre className="text-[11px] leading-[1.4] text-gray-300 font-mono whitespace-pre min-w-[820px]">
{`  YOU (Discord + OpenClaw Office)
        │                     ▲
        ▼                     │  approvals / reports (8am, 10pm)
  ┌───────────────┐    ┌──────────────────┐
  │ Discord bot    │◄──►│ openclaw-office   │  Workboard · Agent Thoughts
  │ #openclaw      │    │ dashboard (Next)  │  Approvals · Pause Control
  └───────────────┘    └─────────┬─────────┘
                                  ▼
                        ┌───────────────────┐
                        │ OpenClaw Gateway    │  cron scheduler
                        │ Workboard engine    │  approval gate (blocks on
                        │                     │  irreversible/decision work)
                        └──────────┬──────────┘
                                   ▼
          ┌────────────────────────────────────────────┐
          │ agent1 (orchestrator) ──delegates──► main   │
          │                                     │       │
          │                                     ▼       │
          │                                 subagents    │
          └────────────────────┬───────────────────────┘
                                ▼
                     ┌─────────────────────┐
                     │ Ollama runtime        │
                     │  ┌─────────────────┐  │
                     │  │ Tesla T4 16GB   │  │  qwen2.5-coder:14b
                     │  │ (incoming)      │  │  qwen3:4b / qwen2.5:7b
                     │  └─────────────────┘  │
                     │  qwen2.5:14b (CPU      │  overflow tier
                     │  fallback / overflow)  │
                     └──────────┬────────────┘
                                ▼
                ┌───────────────────────────────┐
                │ ~/tower-defense (Godot repo)   │  core/ visual/ data/
                │ ~/.openclaw/workspace           │  assets/ tests/ GDD.md
                └───────────────────────────────┘`}
        </pre>
      </div>

      {/* Model tiers */}
      <div className="bg-black/30 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wide">Model Tiers</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-800">
                <th className="py-2 pr-4">Model</th>
                <th className="py-2 pr-4">Size</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {MODEL_TIERS.map((m) => (
                <tr key={m.name} className="border-b border-gray-900 text-gray-300">
                  <td className="py-2 pr-4 font-mono text-gray-100">{m.name}</td>
                  <td className="py-2 pr-4 text-gray-500">{m.size}</td>
                  <td className="py-2 pr-4">{m.role}</td>
                  <td className="py-2 text-gray-500">{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Guidelines given to agents */}
      <div className="bg-black/30 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wide">Guidelines Given to Agents</h3>
        </div>
        <p className="text-sm text-gray-400 mb-3">
          Persisted as <code className="text-cyan-300">STUDIO.md</code> in the agent workspace (loaded at session
          startup alongside <code className="text-cyan-300">AGENTS.md</code>). Keep it in sync if the studio evolves.
        </p>
        <ul className="text-sm text-gray-300 space-y-1.5 list-disc list-inside">
          <li>All irreversible/destructive actions and design decisions route through the Approval gate — never bypass it.</li>
          <li>Game design decisions (mechanics, balance, scope) require human sign-off via Discord/Office before implementation.</li>
          <li>Track all work as Workboard cards; heartbeat while running; complete/block honestly.</li>
          <li>Prefer <span className="font-mono">qwen2.5-coder:14b</span> for GDScript edits once GPU is live; use small models for triage; don't lean on cloud fallbacks for routine work.</li>
          <li>Respect the global Pause control — if the gateway is suspended, stop and wait, don't work around it.</li>
        </ul>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-600">
        <GitBranch className="w-3.5 h-3.5" />
        <span>Source of truth: STUDIO.md (workspace) · this tab mirrors it for quick reference.</span>
      </div>
    </motion.div>
  )
}
