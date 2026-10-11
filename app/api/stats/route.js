// Stats API for OpenClaw Office
// Returns real interaction statistics from SQLite.
//
// Note: token/cost/savings figures live in /api/stats/cost (real gateway
// session data priced against each agent's actual model). This endpoint
// used to also compute its own token/cost/savings numbers from a legacy
// JSONL session-file reader pointed at a stale, hardcoded path
// (`/Users/wickedman-macmini/...`) left over from an earlier template —
// that path never existed on this server, so those fields were always
// zero/bogus (and silently logged an error on every poll). Nothing in the
// UI ever read them, so they've been removed rather than fixed in place.

import { 
  getTodayStats, 
  getAllTimeStats, 
} from '../../../lib/db'

export async function GET() {
  try {
    // Get SQLite stats (messages, tasks)
    const today = getTodayStats()
    const allTime = getAllTimeStats()

    const todayTotalMessages = (today.messages_received || 0) + (today.messages_sent || 0)
    const allTimeTotalMessages = (allTime.messages_received || 0) + (allTime.messages_sent || 0)

    return Response.json({
      today: {
        messages: todayTotalMessages,
        tasks_completed: today.tasks_completed || 0,
        task_time_ms: today.total_task_time_ms || 0,
        human_time_ms: today.estimated_human_time_ms || 0,
      },
      allTime: {
        messages: allTimeTotalMessages,
        tasks_completed: allTime.tasks_completed || 0,
        task_time_ms: allTime.total_task_time_ms || 0,
        human_time_ms: allTime.estimated_human_time_ms || 0,
      },
      source: 'sqlite',
    })
  } catch (error) {
    console.error('Stats API error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
