import { readStudioPlan } from '../../../../lib/construction'

export async function GET() {
  const content = readStudioPlan()
  if (!content) {
    return Response.json({ error: 'Studio plan (STUDIO.md) not found' }, { status: 404 })
  }
  return Response.json({ content })
}
