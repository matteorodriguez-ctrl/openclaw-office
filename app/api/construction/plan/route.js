import { requireProject, readProjectPlan, ConstructionError } from '../../../../lib/construction'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('project')
  const ref = searchParams.get('ref') || undefined
  if (!slug) return Response.json({ error: 'Missing project' }, { status: 400 })

  try {
    const project = requireProject(slug)
    const plan = readProjectPlan(project, ref)
    if (!plan) {
      return Response.json({ error: 'No plan file configured or found for this project' }, { status: 404 })
    }
    return Response.json({ project: slug, planFile: project.plan_file, ...plan })
  } catch (err) {
    const status = err instanceof ConstructionError ? err.status : 500
    return Response.json({ error: err.message || 'Failed to read plan' }, { status })
  }
}
