import React, { useState, useRef, useEffect } from 'react'
import { setBranchLabel, renameBranch } from '../lib/store.js'
import Modal from './Modal.jsx'

// Branch-title editor, opened by clicking a title in edit mode's `label` tool.
// A branch isn't a record of its own — it exists because skills name it — so
// "rename" here rewrites `branch` on every skill in it, while position and
// visibility are per-realm overrides keyed by the branch name.
export default function BranchLabelEditor({ realmId, branch, override = {}, onClose }) {
  const [name, setName] = useState(branch)
  const nameRef = useRef(null)
  const hidden = !!override.hidden
  const pinned = Number.isFinite(override.x) && Number.isFinite(override.y)

  useEffect(() => { nameRef.current?.select() }, [])

  const submit = (e) => {
    e.preventDefault()
    const n = name.trim()
    if (n && n !== branch) renameBranch(realmId, branch, n)
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <form className="skill-editor" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3 className="skill-editor-title">Branch title</h3>
        <p className="skill-editor-cell">
          {pinned ? `moved to (${Math.round(override.x)}, ${Math.round(override.y)})` : 'auto-placed'}
          {hidden ? ' · hidden' : ''}
        </p>

        <label className="skill-editor-field">
          <span>Title</span>
          <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Branch name" />
        </label>
        <p className="skill-editor-hint">
          Renaming retitles every skill in this branch — the skills themselves are untouched.
        </p>

        <div className="skill-editor-row">
          <button
            type="button"
            className="realm-filter"
            onClick={() => { setBranchLabel(realmId, branch, { hidden: !hidden }); onClose() }}
          >
            {hidden ? 'show title' : 'hide title'}
          </button>
          <button
            type="button"
            className="realm-filter"
            disabled={!pinned}
            onClick={() => { setBranchLabel(realmId, branch, { x: undefined, y: undefined }); onClose() }}
            title={pinned ? 'Put the title back where the layout wants it' : 'Already auto-placed'}
          >
            reset position
          </button>
        </div>

        <div className="skill-editor-actions">
          <button type="button" className="realm-filter" onClick={onClose}>cancel</button>
          <button type="submit" className="realm-filter on" disabled={!name.trim()}>save</button>
        </div>
      </form>
    </Modal>
  )
}
