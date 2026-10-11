import { requireProject, listBranches, ConstructionError } from '../../../../lib/construction'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('project')
  if (!slug) return Response.json({ error: 'Missing project' }, { status: 400 })

  try {
    const project = requireProject(slug)
    const { branches, current } = listBranches(project)
    return Response.json({ project: slug, branches, current })
  } catch (err) {
    const status = err instanceof ConstructionError ? err.status : 500
    return Response.json({ error: err.message || 'Failed to list branches' }, { status })
  }
}
