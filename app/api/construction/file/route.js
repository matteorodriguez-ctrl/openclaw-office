import { requireProject, readProjectFile, ConstructionError } from '../../../../lib/construction'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('project')
  const path = searchParams.get('path')
  const ref = searchParams.get('ref') || undefined
  if (!slug) return Response.json({ error: 'Missing project' }, { status: 400 })
  if (!path) return Response.json({ error: 'Missing path' }, { status: 400 })

  try {
    const project = requireProject(slug)
    const file = readProjectFile(project, path, ref)
    return Response.json({ project: slug, ...file })
  } catch (err) {
    const status = err instanceof ConstructionError ? err.status : 500
    return Response.json({ error: err.message || 'Failed to read file' }, { status })
  }
}
