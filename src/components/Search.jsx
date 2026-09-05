import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTree, statusOf, STATUS_LABEL } from '../lib/store.js'

function score(query, text) {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let qi = 0, s = 0, streak = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++
      streak++
      s += 1 + streak * 0.5 + (ti === 0 || t[ti - 1] === ' ' ? 2 : 0)
    } else streak = 0
  }
  return qi === q.length ? s : -1
}

export default function Search({ open, onClose, onPick }) {
  const tree = useTree()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setSel(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const results = useMemo(() => {
    if (!q.trim()) return []
    return tree.skills
      .map((k) => ({ k, s: score(q, `${k.name} ${k.branch}`) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map((x) => x.k)
  }, [q, tree.skills])

  useEffect(() => setSel(0), [results.length, q])

  if (!open) return null

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter' && results[sel]) { onPick(results[sel]) }
    else if (e.key === 'Escape') onClose()
  }

  return (
    <div className="search-veil" onClick={onClose}>
      <div className="search-box" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder="Find a skill… (Esc to close)"
          spellCheck={false}
        />
        {results.length > 0 && (
          <ul className="search-results">
            {results.map((k, i) => {
              const st = statusOf(k, tree.progress)
              return (
                <li key={k.id}>
                  <button
                    className={`search-row ${i === sel ? 'sel' : ''}`}
                    onMouseEnter={() => setSel(i)}
                    onClick={() => onPick(k)}
                  >
                    <span className="search-icon">{k.icon || '◆'}</span>
                    <span className="search-name">{k.name}</span>
                    <span className="search-where">{k.branch}</span>
                    <span className={`search-status ${st}`}>{STATUS_LABEL[st]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {q.trim() && results.length === 0 && <p className="search-empty">nothing matches</p>}
      </div>
    </div>
  )
}
