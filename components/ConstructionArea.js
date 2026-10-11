'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Hammer, FolderGit2, BookOpen, Folder, File, ChevronRight, Home, Loader2, GitBranch, GitGraph } from 'lucide-react'
import SimpleMarkdown from './SimpleMarkdown'
import CommitGraph from './CommitGraph'

const SUBTABS = [
  { id: 'studio', label: 'Studio Plan', icon: Hammer },
  { id: 'project', label: 'Project Plan', icon: BookOpen },
  { id: 'browse', label: 'Browse Code', icon: FolderGit2 },
  { id: 'graph', label: 'Commit Graph', icon: GitGraph },
]

export default function ConstructionArea() {
  const [subtab, setSubtab] = useState('studio')
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)

  const [studioPlan, setStudioPlan] = useState(null)
  const [studioError, setStudioError] = useState(null)
  const [projectPlan, setProjectPlan] = useState(null)
  const [projectPlanError, setProjectPlanError] = useState(null)

  const [dirPath, setDirPath] = useState('')
  const [entries, setEntries] = useState([])
  const [treeLoading, setTreeLoading] = useState(false)
  const [treeError, setTreeError] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileLoading, setFileLoading] = useState(false)

  const [branches, setBranches] = useState([])
  const [currentBranch, setCurrentBranch] = useState(null)
  const [selectedBranch, setSelectedBranch] = useState(null)

  // Load project registry once
  useEffect(() => {
    fetch('/api/construction/projects')
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects || [])
        if (data.projects?.length) setSelectedProject(data.projects[0].slug)
      })
      .catch(() => {})
  }, [])

  // Studio plan loads once (project-agnostic)
  useEffect(() => {
    fetch('/api/construction/studio-plan')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setStudioError(data.error)
        else setStudioPlan(data.content)
      })
      .catch((err) => setStudioError(err.message))
  }, [])

  // Project plan + file tree reload whenever the selected project changes
  useEffect(() => {
    if (!selectedProject) return
    setProjectPlan(null)
    setProjectPlanError(null)
    fetch(`/api/construction/plan?project=${encodeURIComponent(selectedProject)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setProjectPlanError(data.error)
        else setProjectPlan(data)
      })
      .catch((err) => setProjectPlanError(err.message))

    fetch(`/api/construction/branches?project=${encodeURIComponent(selectedProject)}`)
      .then((r) => r.json())
      .then((data) => {
        setBranches(data.branches || [])
        setCurrentBranch(data.current || null)
        setSelectedBranch(data.current || null)
      })
      .catch(() => {})

    setDirPath('')
    setSelectedFile(null)
  }, [selectedProject])

  const loadDirectory = useCallback(
    (path) => {
      if (!selectedProject) return
      setTreeLoading(true)
      setTreeError(null)
      const refParam = selectedBranch ? `&ref=${encodeURIComponent(selectedBranch)}` : ''
      fetch(`/api/construction/tree?project=${encodeURIComponent(selectedProject)}&path=${encodeURIComponent(path)}${refParam}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) setTreeError(data.error)
          else setEntries(data.entries || [])
        })
        .catch((err) => setTreeError(err.message))
        .finally(() => setTreeLoading(false))
    },
    [selectedProject, selectedBranch]
  )

  useEffect(() => {
    if (subtab === 'browse' && selectedProject && selectedBranch) loadDirectory(dirPath)
  }, [subtab, selectedProject, selectedBranch, dirPath, loadDirectory])

  const switchBranch = (branch) => {
    setSelectedBranch(branch)
    setDirPath('')
    setSelectedFile(null)
  }

  const openFile = (entry) => {
    setFileLoading(true)
    setSelectedFile(null)
    const refParam = selectedBranch ? `&ref=${encodeURIComponent(selectedBranch)}` : ''
    fetch(`/api/construction/file?project=${encodeURIComponent(selectedProject)}&path=${encodeURIComponent(entry.path)}${refParam}`)
      .then((r) => r.json())
      .then((data) => setSelectedFile(data))
      .catch((err) => setSelectedFile({ error: err.message }))
      .finally(() => setFileLoading(false))
  }

  const breadcrumbs = dirPath ? dirPath.split('/') : []

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-black/30 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Hammer className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-gray-100">Construction Area</h2>
          </div>
          {projects.length > 0 && (
            <select
              value={selectedProject || ''}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-black/40 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200"
            >
              {projects.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-2">
          The studio's overall plan, the current project's plan, and a GitHub-style browser into its git repo —
          built so new projects can be plugged in later without touching the UI.
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        {SUBTABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setSubtab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                subtab === t.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-black/30 text-gray-400 border border-gray-800 hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {subtab === 'studio' && (
        <div className="bg-black/30 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-3 font-mono">source: .openclaw/workspace/STUDIO.md</p>
          {studioError && <p className="text-sm text-red-400">{studioError}</p>}
          {!studioError && !studioPlan && <p className="text-sm text-gray-500">Loading…</p>}
          {studioPlan && <SimpleMarkdown text={studioPlan} />}
        </div>
      )}

      {subtab === 'project' && (
        <div className="bg-black/30 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-3 font-mono">
            source: {projects.find((p) => p.slug === selectedProject)?.planFile || '—'}
          </p>
          {projectPlanError && <p className="text-sm text-red-400">{projectPlanError}</p>}
          {!projectPlanError && !projectPlan && <p className="text-sm text-gray-500">Loading…</p>}
          {projectPlan && <SimpleMarkdown text={projectPlan.content} />}
        </div>
      )}

      {subtab === 'browse' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 bg-black/30 border border-gray-800 rounded-xl p-4">
            {/* Branch selector */}
            {branches.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <GitBranch className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <select
                  value={selectedBranch || ''}
                  onChange={(e) => switchBranch(e.target.value)}
                  className="bg-black/40 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 flex-1 min-w-0"
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                      {b === currentBranch ? ' (checked out)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-xs text-gray-400 mb-3 flex-wrap">
              <button onClick={() => setDirPath('')} className="flex items-center gap-1 hover:text-cyan-300">
                <Home className="w-3.5 h-3.5" />
                root
              </button>
              {breadcrumbs.map((seg, i) => {
                const pathUpTo = breadcrumbs.slice(0, i + 1).join('/')
                return (
                  <span key={i} className="flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 text-gray-600" />
                    <button onClick={() => setDirPath(pathUpTo)} className="hover:text-cyan-300">
                      {seg}
                    </button>
                  </span>
                )
              })}
            </div>

            {treeLoading && (
              <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            )}
            {treeError && <p className="text-sm text-red-400">{treeError}</p>}

            <div className="space-y-0.5">
              {entries.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() =>
                    entry.type === 'dir' ? setDirPath(entry.path) : openFile(entry)
                  }
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors ${
                    selectedFile?.path === entry.path
                      ? 'bg-cyan-500/15 text-cyan-300'
                      : 'text-gray-300 hover:bg-white/5'
                  }`}
                >
                  {entry.type === 'dir' ? (
                    <Folder className="w-4 h-4 text-cyan-500 shrink-0" />
                  ) : (
                    <File className="w-4 h-4 text-gray-500 shrink-0" />
                  )}
                  <span className="truncate">{entry.name}</span>
                </button>
              ))}
              {!treeLoading && !treeError && entries.length === 0 && (
                <p className="text-sm text-gray-600 py-2">Empty directory.</p>
              )}
            </div>
          </div>

          <div className="lg:col-span-3 bg-black/30 border border-gray-800 rounded-xl p-4 min-h-[300px]">
            {!selectedFile && !fileLoading && (
              <p className="text-sm text-gray-600">Select a file to view its contents.</p>
            )}
            {fileLoading && (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading file…
              </div>
            )}
            {selectedFile && !fileLoading && (
              <>
                <p className="text-xs text-gray-500 mb-3 font-mono truncate">
                  {selectedFile.ref ? `${selectedFile.ref}:` : ''}
                  {selectedFile.path}
                </p>
                {selectedFile.error && <p className="text-sm text-red-400">{selectedFile.error}</p>}
                {selectedFile.binary && (
                  <p className="text-sm text-gray-500">
                    Binary file ({(selectedFile.size / 1024).toFixed(1)} KB) — preview not available.
                  </p>
                )}
                {selectedFile.tooLarge && (
                  <p className="text-sm text-gray-500">
                    File too large to preview ({(selectedFile.size / 1024).toFixed(1)} KB).
                  </p>
                )}
                {selectedFile.content !== undefined && !selectedFile.binary && !selectedFile.tooLarge && (
                  <pre className="text-xs font-mono text-gray-300 bg-black/40 border border-gray-800 rounded-lg p-3 overflow-auto max-h-[70vh] whitespace-pre">
                    {selectedFile.content}
                  </pre>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {subtab === 'graph' && (
        <div className="bg-black/30 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-3">
            Commit graph across all branches — each colored lane is a branch; dots merge where histories join.
          </p>
          {selectedProject && <CommitGraph project={selectedProject} />}
        </div>
      )}
    </motion.div>
  )
}
