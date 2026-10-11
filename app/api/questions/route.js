import { NextResponse } from 'next/server'
import { callGatewayMethod } from '../../../lib/openclaw-ws'

// Surfaces OpenClaw's native "question" system — the mechanism an agent uses
// (e.g. via the ask_user tool) to pause mid-task and ask the operator a
// judgment-call question. Distinct from exec/plugin approvals (/api/approvals),
// which gate *actions*; this gates *decisions*.

export async function GET() {
  try {
    const result = await callGatewayMethod('question.list', {})
    const records = result?.questions || []

    const questions = records
      .filter((q) => q.status === 'pending')
      .map((q) => ({
        id: q.id,
        agentId: q.agentId || null,
        sessionKey: q.sessionKey || null,
        createdAtMs: q.createdAtMs,
        expiresAtMs: q.expiresAtMs,
        // Each record can bundle up to 3 related sub-questions.
        questions: (q.questions || []).map((sub) => ({
          questionId: sub.questionId,
          header: sub.header,
          question: sub.question,
          options: sub.options || [],
          multiSelect: !!sub.multiSelect,
          isOther: !!sub.isOther,
        })),
      }))
      .sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0))

    return NextResponse.json({ questions })
  } catch (error) {
    console.error('Failed to list questions:', error)
    return NextResponse.json({ questions: [], error: error.message }, { status: 200 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { id, answers, cancel } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const params = cancel ? { id, cancel: true } : { id, answers: { answers } }
    const result = await callGatewayMethod('question.resolve', params)
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    console.error('Failed to resolve question:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
