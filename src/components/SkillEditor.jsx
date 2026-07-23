import React, { useState, useRef, useEffect } from 'react'
import { createSkill } from '../lib/store.js'

// Lightweight create-a-skill form, opened by clicking an empty lattice cell in
// edit mode. Styled off the panel look (see .skill-editor in styles.css) rather
// than reusing Panel.jsx, which is purpose-built for progress tracking. The new
// skill is pinned to the clicked cell via `pos`, so it lands exactly there.
export default function SkillEditor({ realmId, at, branches, onClose }) {
  const [name, setName] = useState('')
  const [branch, setBranch] = useState(branches[0] || '')
  const [icon, setIcon] = useState('')
  const nameRef = useRef(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  const submit = (e) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    createSkill(realmId, { name: n, branch: branch.trim() || 'Misc', icon: icon.trim(), req: [], pos: at })
    onClose()
  }

  return (
    <div className="skill-editor-scrim" onClick={onClose}>
      <form className="skill-editor" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3 className="skill-editor-title">New skill</h3>
        <p className="skill-editor-cell">on cell ({at.q}, {at.r})</p>

        <label className="skill-editor-field">
          <span>Name</span>
          <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Front Lever" />
        </label>

        <label className="skill-editor-field">
          <span>Branch</span>
          <input list="editor-branches" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Branch name" />
          <datalist id="editor-branches">
            {branches.map((b) => <option key={b} value={b} />)}
          </datalist>
        </label>

        <label className="skill-editor-field">
          <span>Icon</span>
          <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="emoji (optional)" maxLength={4} />
        </label>

        <div className="skill-editor-actions">
          <button type="button" className="realm-filter" onClick={onClose}>cancel</button>
          <button type="submit" className="realm-filter on" disabled={!name.trim()}>create</button>
        </div>
      </form>
    </div>
  )
}
