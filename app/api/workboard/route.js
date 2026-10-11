/**
 * Workboard API
 *
 * Read-only proxy to the OpenClaw gateway's Workboard plugin RPC methods,
 * surfaced for the dashboard's Workboard tab.
 */

import { callGatewayMethod } from '../../../lib/openclaw-ws.js'

export async function GET() {
  try {
    const [list, stats] = await Promise.all([
      callGatewayMethod('workboard.cards.list', {}),
      callGatewayMethod('workboard.cards.stats', {}),
    ])

    return Response.json({
      cards: list?.cards || [],
      boards: list?.boards || [],
      statuses: list?.statuses || [],
      stats: stats || null,
    })
  } catch (error) {
    return Response.json(
      { error: error.message, cards: [], boards: [], statuses: [], stats: null },
      { status: 503 }
    )
  }
}
