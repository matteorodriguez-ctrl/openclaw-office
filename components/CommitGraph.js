'use client'

import { useState, useEffect } from 'react'
import { Loader2, Tag, GitCommitHorizontal } from 'lucide-react'

const LANE_WIDTH = 18
const ROW_HEIGHT = 34
const PADDING_LEFT = 14
const DOT_RADIUS = 5

const LANE_COLORS = ['#22d3ee', '#a78bfa', '#4ade80', '#fb923c', '#f472b6', '#facc15', '#60a5fa']

function laneColor(lane) {
  return LANE_COLORS[lane % LANE_COLORS.length]
}

// Renders a GitHub-"network"-style commit graph from the pre-computed
// lane/segment data returned by /api/construction/graph.
export default function CommitGraph({ project }) {
  const [graph, setGraph] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!project) return
    setGraph(null)
    setError(null)
    fetch(`/api/construction/graph?project=${encodeURIComponent(project)}&limit=150`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setGraph(data)
      })
      .catch((err) => setError(err.message))
  }, [project])

  if (error) return <p className="text-sm text-red-400">{error}</p>
  if (!graph) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading commit graph…
      </div>
    )
  }
  if (graph.commits.length === 0) {
    return <p className="text-sm text-gray-600">No commits found.</p>
  }

  const svgWidth = PADDING_LEFT + graph.maxLanes * LANE_WIDTH
  const svgHeight = graph.commits.length * ROW_HEIGHT

  const x = (lane) => PADDING_LEFT + lane * LANE_WIDTH
  const y = (row) => row * ROW_HEIGHT + ROW_HEIGHT / 2

  return (
    <div className="space-y-2">
      <div className="flex max-h-[520px] overflow-y-auto">
        <svg width={svgWidth} height={svgHeight} className="shrink-0">
          {graph.segments.map((seg, i) => {
            const x1 = x(seg.fromLane)
            const y1 = y(seg.fromRow)
            const x2 = x(seg.toLane)
            const y2 = y(seg.toRow)
            const color = laneColor(seg.fromLane === seg.toLane ? seg.fromLane : Math.min(seg.fromLane, seg.toLane))
            if (x1 === x2) {
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2" />
            }
            // Diagonal branch/merge connector, curved for readability.
            const midY = (y1 + y2) / 2
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                stroke={color}
                strokeWidth="2"
                fill="none"
              />
            )
          })}
          {graph.commits.map((c) => (
            <circle
              key={c.hash}
              cx={x(c.lane)}
              cy={y(c.row)}
              r={DOT_RADIUS}
              fill={laneColor(c.lane)}
              stroke="#0b0f14"
              strokeWidth="1.5"
            />
          ))}
        </svg>

        <div className="flex-1 min-w-0">
          {graph.commits.map((c) => (
            <div
              key={c.hash}
              className="flex items-center gap-2 px-2 border-b border-gray-900/60 overflow-hidden"
              style={{ height: ROW_HEIGHT }}
              title={c.subject}
            >
              <GitCommitHorizontal className="w-3.5 h-3.5 text-gray-600 shrink-0" />
              <span className="font-mono text-xs text-cyan-400 shrink-0">{c.shortHash}</span>
              <span className="text-sm text-gray-300 truncate">{c.subject}</span>
              {c.refs.map((ref) => (
                <span
                  key={ref}
                  className="flex items-center gap-0.5 text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded px-1.5 py-0.5 shrink-0"
                >
                  <Tag className="w-2.5 h-2.5" />
                  {ref}
                </span>
              ))}
              <span className="text-xs text-gray-600 shrink-0 ml-auto hidden sm:inline">
                {c.author} · {c.date}
              </span>
            </div>
          ))}
        </div>
      </div>
      {graph.truncated && (
        <p className="text-xs text-gray-600">Showing the most recent {graph.commits.length} commits.</p>
      )}
    </div>
  )
}
