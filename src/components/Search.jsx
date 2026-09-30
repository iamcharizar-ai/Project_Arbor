import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTree, useDerived, STATUS_LABEL, STATUS_KEYS } from '../lib/store.js'
import { findSkills } from '../lib/search.js'
import { SkillIcon } from './Pixel.jsx'

export default function Search({ open, onClose, onPick }) {
  if (!open) return null
  return <SearchBox onClose={onClose} onPick={onPick} />
}

// Mounted only while open, so it costs nothing (and re-renders nothing) the rest of the time.
function SearchBox({ onClose, onPick }) {
  const tree = useTree()
  const derived = useDerived()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  const results = useMemo(() => findSkills(tree.skills, q, 12), [q, tree.skills])
  useEffect(() => setSel(0), [q])

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter' && results[sel]) onPick(results[sel])
  }

  return (
    <div className="veil search-veil" onClick={onClose}>
      <div className="dialog search-box" role="dialog" aria-modal="true" aria-label="Find a skill" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder="Find a skill... (Esc to close)"
          spellCheck={false}
          aria-label="Find a skill"
        />
        {results.length > 0 && (
          <ul className="search-results">
            {results.map((k, i) => {
              const st = STATUS_KEYS[derived.statusById.get(k.id) ?? 0]
              return (
                <li key={k.id}>
                  <button className={`search-row ${i === sel ? 'sel' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => onPick(k)}>
                    <SkillIcon id={k.id} status={st} />
                    <span className="search-name">{k.name}</span>
                    <span className="search-where">{k.branch}</span>
                    <span className={`status-tag sm ${st}`}>{STATUS_LABEL[st]}</span>
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
