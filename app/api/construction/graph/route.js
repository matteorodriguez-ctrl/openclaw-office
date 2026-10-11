import { requireProject, getCommitGraph, ConstructionError } from '../../../../lib/construction'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('project')
  const limit = searchParams.get('limit')
  if (!slug) return Response.json({ error: 'Missing project' }, { status: 400 })

  try {
    const project = requireProject(slug)
    const graph = getCommitGraph(project, limit)
    return Response.json({ project: slug, ...graph })
  } catch (err) {
    const status = err instanceof ConstructionError ? err.status : 500
    return Response.json({ error: err.message || 'Failed to build commit graph' }, { status })
  }
}
