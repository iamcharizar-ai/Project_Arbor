import React, { useEffect, useMemo, useRef } from 'react'
import { layoutTree } from '../lib/layout.js'
import { TreeRenderer } from '../lib/treeRenderer.js'
import { useTree, useDerived, getState, rec, STATUS_KEYS } from '../lib/store.js'
import { Px } from './Pixel.jsx'

// The skills are static, so the layout is computed once for the whole session.
const LAYOUT = layoutTree(getState().skills)

const PILLARS = [
  { id: 'Horizontal Push', label: 'H. Push', branches: ['Horizontal Push'] },
  { id: 'Vertical Push', label: 'V. Push', branches: ['Vertical Push'] },
  { id: 'Horizontal Pull', label: 'H. Pull', branches: ['Horizontal Pull'] },
  { id: 'Vertical Pull', label: 'V. Pull', branches: ['Vertical Pull'] },
  { id: 'Core', label: 'Core', branches: ['Core'] },
  { id: 'Legs', label: 'Legs', branches: ['Legs'] },
  { id: 'Flexibility', label: 'Mobility', branches: ['Flexibility', 'Mobility Foundations', 'Arm Balances', 'Yoga Holds'] },
  { id: 'Flips & Twists', label: 'Movement', branches: ['Flips & Twists', 'Acrobatics Foundations', 'Kicks', 'Breaking', 'Dance'] },
]

const FILTERS = [
  { id: 'all', label: 'all' },
  { id: 'next', label: 'next' },
  { id: 'training', label: 'active' },
  { id: 'mastered', label: 'mastered' },
]

// Open on the branch you touched last; a fresh device opens on the first steps.
function startBranches() {
  const { progress } = getState()
  let best = null
  for (const [id, r] of Object.entries(progress)) {
    const i = LAYOUT.index.get(id)
    if (i != null && r.asOf && (!best || r.asOf > best.asOf)) best = { asOf: r.asOf, branch: LAYOUT.nodes[i].branch }
  }
  return best ? [best.branch] : ['Physical Foundations', 'Horizontal Push']
}

export default function Tree({ onSelect, selectedId, focus, filter, onFilter, pillar, onPillar, overview }) {
  const tree = useTree()
  const derived = useDerived()
  const canvasRef = useRef(null)
  const rendererRef = useRef(null)
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect
  const lastPulse = useRef(tree.pulse?.n || 0)

  useEffect(() => {
    const r = new TreeRenderer(canvasRef.current, LAYOUT, {
      onSelect: (i) => selectRef.current(i >= 0 ? LAYOUT.nodes[i].skill : null),
    })
    rendererRef.current = r
    if (import.meta.env.DEV) window.__arbor = r // dev-only handle for debugging / profiling
    r.fitBranches(startBranches(), false)
    return () => { r.destroy(); rendererRef.current = null }
  }, [])

  // statuses + adaptation gears → renderer
  useEffect(() => {
    const r = rendererRef.current
    const n = LAYOUT.nodes.length
    const status = new Uint8Array(n), adapt = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
      const id = LAYOUT.nodes[i].id
      status[i] = derived.statusById.get(id) ?? 0
      adapt[i] = Math.min(255, rec(id, tree.progress).adapt || 0)
    }
    r.setStatus(status, adapt)
  }, [derived, tree.progress])

  // filter → dim mask
  const dim = useMemo(() => {
    if (filter === 'all') return null
    const next = filter === 'next' ? new Set(derived.frontier.map((k) => k.id)) : null
    const mask = new Uint8Array(LAYOUT.nodes.length)
    LAYOUT.nodes.forEach((nd, i) => {
      const st = derived.statusById.get(nd.id) ?? 0
      const keep = filter === 'next' ? next.has(nd.id)
        : filter === 'training' ? st === 1 || st === 2
        : st === 3
      mask[i] = keep ? 0 : 1
    })
    return mask
  }, [filter, derived])
  useEffect(() => { rendererRef.current.setDim(dim) }, [dim])

  useEffect(() => {
    rendererRef.current.setSelected(selectedId ? (LAYOUT.index.get(selectedId) ?? -1) : -1)
  }, [selectedId])

  // tier-up → burst on the node
  useEffect(() => {
    const p = tree.pulse
    if (!p || p.n === lastPulse.current) return
    lastPulse.current = p.n
    const i = LAYOUT.index.get(p.skillId)
    if (i != null) rendererRef.current.burst(i, STATUS_KEYS.indexOf(p.status))
  }, [tree.pulse])

  useEffect(() => {
    if (!focus) return
    const i = LAYOUT.index.get(focus.id)
    if (i != null) rendererRef.current.focusNode(i)
  }, [focus])

  useEffect(() => {
    if (!pillar) return
    const spec = PILLARS.find((p) => p.id === pillar)
    rendererRef.current.fitBranches(spec ? spec.branches : [pillar])
  }, [pillar])

  useEffect(() => { if (overview) rendererRef.current.fitAll() }, [overview])

  const zoom = (f) => rendererRef.current?.zoomBy(f)

  return (
    <div className="realm-canvas">
      <canvas
        ref={canvasRef}
        className="tree-canvas"
        tabIndex={0}
        role="application"
        aria-label="Skill tree. Drag to pan, scroll or pinch to zoom, arrow keys to pan. Ctrl+K searches skills."
      />
      <div className="zoom-controls">
        <button type="button" onClick={() => zoom(1.4)} aria-label="Zoom in"><Px name="plus" /></button>
        <button type="button" onClick={() => zoom(1 / 1.4)} aria-label="Zoom out"><Px name="minus" /></button>
        <button type="button" onClick={() => { onPillar(null); rendererRef.current.fitAll() }} aria-label="Fit whole tree"><Px name="fit" /></button>
      </div>
      <div className="realm-hud">
        <div className="realm-filters" role="group" aria-label="Jump to a branch">
          {PILLARS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`chip ${pillar === p.id ? 'on' : ''}`}
              aria-pressed={pillar === p.id}
              onClick={() => {
                if (pillar === p.id) rendererRef.current.fitBranches(p.branches)
                onPillar(p.id)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="realm-filters" role="group" aria-label="Filter skills">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip alt ${filter === f.id ? 'on' : ''}`}
              aria-pressed={filter === f.id}
              onClick={() => onFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="legend">
          <span><i className="sw locked" /> locked</span>
          <span><i className="sw unlocked" /> unlocked</span>
          <span><i className="sw inprogress" /> in progress</span>
          <span><i className="sw mastered" /> mastered</span>
        </div>
      </div>
    </div>
  )
}
