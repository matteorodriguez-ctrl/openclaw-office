import { listProjects } from '../../../../lib/db'

export async function GET() {
  const projects = listProjects().map((p) => ({
    slug: p.slug,
    name: p.name,
    description: p.description,
    planFile: p.plan_file,
  }))
  return Response.json({ projects })
}
