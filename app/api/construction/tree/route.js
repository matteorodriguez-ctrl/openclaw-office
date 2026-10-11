import { requireProject, listDirectory, ConstructionError } from '../../../../lib/construction'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('project')
  const path = searchParams.get('path') || ''
  const ref = searchParams.get('ref') || undefined
  if (!slug) return Response.json({ error: 'Missing project' }, { status: 400 })

  try {
    const project = requireProject(slug)
    const entries = listDirectory(project, path, ref)
    return Response.json({ project: slug, path, ref, entries })
  } catch (err) {
    const status = err instanceof ConstructionError ? err.status : 500
    return Response.json({ error: err.message || 'Failed to list directory' }, { status })
  }
}
