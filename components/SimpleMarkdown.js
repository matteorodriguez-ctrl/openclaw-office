'use client'

// Minimal markdown renderer tailored for our own internal docs (headers,
// bold/inline code/links, lists, code blocks, blockquotes, hr). Avoids
// pulling in a full markdown dependency for two internal doc files.
function renderInline(text, keyPrefix) {
  const nodes = []
  let rest = text
  let idx = 0
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/
  while (rest.length) {
    const m = rest.match(regex)
    if (!m) {
      nodes.push(rest)
      break
    }
    if (m.index > 0) nodes.push(rest.slice(0, m.index))
    if (m[2] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-${idx++}`} className="text-gray-100 font-semibold">
          {m[2]}
        </strong>
      )
    } else if (m[3] !== undefined) {
      nodes.push(
        <code key={`${keyPrefix}-${idx++}`} className="bg-black/40 px-1 py-0.5 rounded text-cyan-300 text-xs">
          {m[3]}
        </code>
      )
    } else if (m[4] !== undefined) {
      nodes.push(
        <a
          key={`${keyPrefix}-${idx++}`}
          href={m[5]}
          className="text-cyan-400 underline"
          target="_blank"
          rel="noreferrer"
        >
          {m[4]}
        </a>
      )
    }
    rest = rest.slice(m.index + m[0].length)
  }
  return nodes
}

function parseBlocks(text) {
  const lines = text.split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const code = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        code.push(lines[i])
        i++
      }
      i++ // skip closing fence
      blocks.push({ type: 'code', text: code.join('\n') })
      continue
    }
    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)[0].length
      blocks.push({ type: 'heading', level, text: line.replace(/^#{1,6}\s/, '') })
      i++
      continue
    }
    if (/^(-|\*)\s/.test(line)) {
      const items = []
      while (i < lines.length && /^(-|\*)\s/.test(lines[i])) {
        items.push(lines[i].replace(/^(-|\*)\s/, ''))
        i++
      }
      blocks.push({ type: 'list', items })
      continue
    }
    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }
    const para = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^(-|\*)\s/.test(lines[i]) &&
      !lines[i].startsWith('```')
    ) {
      para.push(lines[i])
      i++
    }
    blocks.push({ type: 'p', text: para.join(' ') })
  }
  return blocks
}

const HEADING_SIZES = ['', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-sm', 'text-sm']

export default function SimpleMarkdown({ text }) {
  if (!text) return null
  const blocks = parseBlocks(text)

  return (
    <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
      {blocks.map((b, idx) => {
        if (b.type === 'heading') {
          const Tag = `h${Math.min(b.level + 1, 6)}`
          return (
            <Tag key={idx} className={`${HEADING_SIZES[b.level]} font-bold text-gray-100 mt-4 first:mt-0`}>
              {renderInline(b.text, idx)}
            </Tag>
          )
        }
        if (b.type === 'list') {
          return (
            <ul key={idx} className="list-disc list-inside space-y-1 pl-2">
              {b.items.map((item, j) => (
                <li key={j}>{renderInline(item, `${idx}-${j}`)}</li>
              ))}
            </ul>
          )
        }
        if (b.type === 'code') {
          return (
            <pre
              key={idx}
              className="bg-black/40 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto font-mono whitespace-pre"
            >
              {b.text}
            </pre>
          )
        }
        if (b.type === 'hr') return <hr key={idx} className="border-gray-800" />
        return <p key={idx}>{renderInline(b.text, idx)}</p>
      })}
    </div>
  )
}
