// Construction Area: safe helpers for browsing a project's git repo and
// reading its planning docs. Repos are mounted read-only into the container
// (see docker-compose.yml) and registered in the `projects` table (lib/db.js).

import { execFileSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { getProject } from './db'

const STUDIO_PLAN_PATH = '/app/.openclaw/workspace/STUDIO.md'

const MAX_FILE_BYTES = 2 * 1024 * 1024 // 2MB

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp',
  '.glb', '.gltf', '.fbx', '.obj',
  '.wav', '.ogg', '.mp3', '.flac',
  '.ttf', '.otf', '.woff', '.woff2',
  '.pck', '.wasm', '.zip', '.tar', '.gz', '.bin', '.exe',
  '.import', '.res', '.scn',
])

export class ConstructionError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

export function requireProject(slug) {
  const project = getProject(slug)
  if (!project) throw new ConstructionError(`Unknown project "${slug}"`, 404)
  if (!existsSync(project.repo_path)) {
    throw new ConstructionError(
      `Project "${slug}" is registered but its repo is not mounted at ${project.repo_path}`,
      503
    )
  }
  return project
}

// Reject a relative path that tries to escape the repo root via "..".
// (Not strictly necessary for git's tree-object lookups below — "../" has
// no special meaning inside a tree object path — but kept as defense in
// depth and to give a clean error instead of a confusing git failure.)
function sanitizeRelPath(relPath) {
  const normalized = (relPath || '').replace(/^\/+|\/+$/g, '')
  if (normalized.split('/').some((seg) => seg === '..')) {
    throw new ConstructionError('Invalid path', 400)
  }
  return normalized
}

function runGit(repoPath, args, opts = {}) {
  return execFileSync('git', ['-C', repoPath, ...args], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...opts,
  })
}

// The branch/tag/commit a project browses by default when no ref is given.
function resolveDefaultRef(repoPath) {
  try {
    return runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()
  } catch {
    return 'HEAD'
  }
}

// List local + remote-tracking branches, plus which one is currently checked out.
export function listBranches(project) {
  const current = resolveDefaultRef(project.repo_path)
  try {
    // Use full refnames (not :short) so we can reliably detect and drop
    // symbolic HEAD refs (e.g. refs/remotes/origin/HEAD) — git's :short
    // form collapses that to a bare "origin", which isn't a real branch.
    const out = runGit(project.repo_path, [
      'for-each-ref',
      '--format=%(refname)',
      'refs/heads/',
      'refs/remotes/',
    ])
    const names = out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((ref) => !ref.endsWith('/HEAD'))
      .map((ref) => ref.replace(/^refs\/(heads|remotes)\//, ''))
    return { branches: Array.from(new Set(names)), current }
  } catch {
    return { branches: current ? [current] : [], current }
  }
}

// List the immediate children of a path within a given ref, via git's tree
// objects directly — this works for any branch/tag/commit without needing
// to check it out, and naturally respects whatever was committed to that ref.
export function listDirectory(project, relPath = '', ref) {
  const normalized = sanitizeRelPath(relPath)
  const resolvedRef = ref || resolveDefaultRef(project.repo_path)
  const treeish = normalized ? `${resolvedRef}:${normalized}` : `${resolvedRef}:`

  let out
  try {
    out = runGit(project.repo_path, ['ls-tree', treeish])
  } catch {
    throw new ConstructionError(`Path or ref not found ("${resolvedRef}:${normalized}")`, 404)
  }

  const entries = out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const tabIdx = line.indexOf('\t')
      const info = line.slice(0, tabIdx).split(' ')
      const name = line.slice(tabIdx + 1)
      const gitType = info[1] // 'blob' | 'tree' | 'commit' (submodule)
      return {
        name,
        type: gitType === 'tree' ? 'dir' : 'file',
        path: normalized ? `${normalized}/${name}` : name,
      }
    })

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return entries
}

export function readProjectFile(project, relPath, ref) {
  const normalized = sanitizeRelPath(relPath)
  const resolvedRef = ref || resolveDefaultRef(project.repo_path)
  const blobRef = `${resolvedRef}:${normalized}`
  const ext = path.extname(normalized).toLowerCase()

  let size
  try {
    size = parseInt(runGit(project.repo_path, ['cat-file', '-s', blobRef]).trim(), 10)
  } catch {
    throw new ConstructionError(`File not found at ${resolvedRef}:${normalized}`, 404)
  }

  if (BINARY_EXTENSIONS.has(ext)) {
    return { binary: true, size, path: normalized, ext, ref: resolvedRef }
  }
  if (size > MAX_FILE_BYTES) {
    return { tooLarge: true, size, path: normalized, ext, ref: resolvedRef }
  }

  const buf = execFileSync('git', ['-C', project.repo_path, 'show', blobRef], {
    maxBuffer: MAX_FILE_BYTES + 1024 * 1024,
  })
  // Binary sniff for extensions we didn't already classify (e.g. unknown binary formats).
  if (buf.includes(0)) {
    return { binary: true, size, path: normalized, ext, ref: resolvedRef }
  }
  return { content: buf.toString('utf8'), size, path: normalized, ext, ref: resolvedRef }
}

export function readProjectPlan(project, ref) {
  if (!project.plan_file) return null
  try {
    return readProjectFile(project, project.plan_file, ref)
  } catch {
    return null
  }
}

export function readStudioPlan() {
  try {
    return readFileSync(STUDIO_PLAN_PATH, 'utf8')
  } catch {
    return null
  }
}

// Build a simplified commit graph (GitHub "network"-style): assigns each
// commit a lane/column so branch and merge points can be drawn as an SVG,
// without needing to actually render with git's own ASCII --graph output.
const GRAPH_FIELD_SEP = '\x1f' // unit separator — won't appear in commit text

export function getCommitGraph(project, limit = 150) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 150, 1), 500)
  const format = `%H${GRAPH_FIELD_SEP}%P${GRAPH_FIELD_SEP}%D${GRAPH_FIELD_SEP}%an${GRAPH_FIELD_SEP}%ad${GRAPH_FIELD_SEP}%s`

  let out
  try {
    out = runGit(project.repo_path, [
      'log',
      '--all',
      '--topo-order',
      '--date=short',
      `--pretty=format:${format}`,
      '-n',
      String(safeLimit),
    ])
  } catch {
    return { commits: [], maxLanes: 0, segments: [], truncated: false }
  }

  const rawCommits = out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, parentsStr, refsStr, author, date, subject] = line.split(GRAPH_FIELD_SEP)
      return {
        hash,
        shortHash: hash.slice(0, 7),
        parents: parentsStr ? parentsStr.split(' ').filter(Boolean) : [],
        refs: refsStr ? refsStr.split(', ').filter(Boolean) : [],
        author,
        date,
        subject,
      }
    })

  // Lane assignment: a simplified version of the standard git-graph
  // algorithm. `activeLanes[i]` holds the commit hash lane `i` is waiting
  // to render next (or null if the lane is free for reuse).
  const activeLanes = []
  const commits = []
  const segments = []

  function findFreeLane() {
    const idx = activeLanes.indexOf(null)
    if (idx !== -1) return idx
    activeLanes.push(null)
    return activeLanes.length - 1
  }

  rawCommits.forEach((commit, row) => {
    const matchingLanes = []
    activeLanes.forEach((lane, idx) => {
      if (lane && lane.hash === commit.hash) matchingLanes.push(idx)
    })

    const primaryLane = matchingLanes.length > 0 ? matchingLanes[0] : findFreeLane()

    // Vertical pass-through for lanes untouched by this commit.
    activeLanes.forEach((lane, idx) => {
      if (lane && !matchingLanes.includes(idx)) {
        segments.push({ fromRow: row - 1, toRow: row, fromLane: idx, toLane: idx })
      }
    })

    // Converging lines for every lane expecting this commit (merge bases,
    // or simply the lane this branch has been riding).
    matchingLanes.forEach((idx) => {
      if (row > 0) segments.push({ fromRow: row - 1, toRow: row, fromLane: idx, toLane: primaryLane })
      activeLanes[idx] = null
    })

    commits.push({ ...commit, lane: primaryLane, row })

    commit.parents.forEach((parentHash, pIdx) => {
      if (pIdx === 0) {
        // First parent continues in the same lane (drawn by the next row's
        // pass-through/convergence logic above).
        activeLanes[primaryLane] = { hash: parentHash }
      } else {
        // Additional parents (merge commits) branch off into a new lane.
        const newLane = findFreeLane()
        activeLanes[newLane] = { hash: parentHash }
        segments.push({ fromRow: row, toRow: row + 1, fromLane: primaryLane, toLane: newLane })
      }
    })
    if (commit.parents.length === 0) {
      activeLanes[primaryLane] = null // root commit, nothing more to draw
    }
  })

  return {
    commits,
    maxLanes: activeLanes.length,
    segments,
    truncated: rawCommits.length === safeLimit,
  }
}
