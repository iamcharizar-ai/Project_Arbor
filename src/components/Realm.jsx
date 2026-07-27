import React, { useMemo, useCallback, useEffect, useState } from 'react'
import { ReactFlow, Handle, Position, useReactFlow, useNodesInitialized, ReactFlowProvider, useStore } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { layoutRealm, axialToPixel, pixelToAxial } from '../lib/layout.js'
import {
  useTree, statusOf, burstOf, rec, frontierSkills,
  moveSkills, updateSkillReq, deleteSkills, labelsOf, setBranchLabel,
} from '../lib/store.js'
import { ScrambleText } from './fx.jsx'
import LatticeBackground from './LatticeBackground.jsx'
import SkillEditor from './SkillEditor.jsx'
import BranchLabelEditor from './BranchLabelEditor.jsx'
import Modal from './Modal.jsx'

// WINGS-style node: bare icon circle + status ring — no text on the canvas,
// the side panel carries name/detail. Memoized hard — with ~290 nodes on
// screen, re-rendering all of them on every selection or tick was the
// zoom-out lag. Only nodes whose props actually changed re-render.
// Both handles sit at the circle's CENTER: edges are then trimmed back to
// the rim in ArrowEdge, so every link touches the circle exactly where the
// 45°/vertical lattice line crosses it.
const SkillNode = React.memo(
  function SkillNode({ data, selected }) {
    const skill = data.skill
    return (
      <div
        className={`sk ${data.status} ${selected ? 'selected' : ''} ${data.dim ? 'dim' : ''} ${data.linkArmed ? 'link-armed' : ''}`}
        style={{ '--d': data.depth }}
        title={skill.name}
      >
        <Handle type="target" position={Position.Bottom} className="handle" />
        <Handle type="source" position={Position.Top} className="handle" />
        <div className="sk-circle">
          {data.burst > 0 && <span className="burst" key={data.burst} />}
          <span className="sk-icon">{skill.icon || '◆'}</span>
          {skill.star && <span className="sk-star">✦</span>}
          {data.adapt > 0 && <span className="sk-adapt" title={`adapted through failure ×${data.adapt}`}>⚙</span>}
        </div>
      </div>
    )
  },
  (a, b) =>
    a.selected === b.selected &&
    a.data.status === b.data.status &&
    a.data.burst === b.data.burst &&
    a.data.adapt === b.data.adapt &&
    a.data.dim === b.data.dim &&
    a.data.linkArmed === b.data.linkArmed,
)

// Branch title. Inert text normally; in edit mode's `label` tool it becomes a
// draggable, clickable object — and titles the user has hidden reappear here
// as ghosts so hiding one isn't a one-way door.
function BranchLabel({ data }) {
  return (
    <div
      className={`branch-label ${data.editable ? 'label-editable' : ''} ${data.hidden ? 'label-hidden' : ''}`}
      title={data.editable ? 'drag to move · click to rename or hide' : undefined}
    >
      {data.label}
    </div>
  )
}

// Empty lattice cell shown only in edit mode. Clicking one opens the editor to
// create a skill pinned there. onlyRenderVisibleElements culls off-screen ones.
const GhostNode = React.memo(function GhostNode({ data }) {
  return (
    <div className="ghost-cell" title={`place a skill at (${data.q}, ${data.r})`}>
      <span>+</span>
    </div>
  )
})

const nodeTypes = { skill: SkillNode, branchLabel: BranchLabel, ghost: GhostNode }

// Edge = the lattice segment between two skills, lit up. React Flow hands us
// the Top/Bottom handle points, which sit ±HALF off the node centre; we recover
// the true CENTRES and draw centre-to-centre, so a clean (lattice-aligned) edge
// lands exactly on the background grid line — it reads as that segment glowing,
// not as a second skewed line drawn over it. Trimmed by RIM to the circle rim.
// No arrowhead: the tree grows upward, so direction is already legible, and a
// mid-line arrow would break the "the lattice itself lit up" illusion.
const HALF = 30 // half the 60px node — handle offset from centre
const RIM = 30 // circle radius + breathing room
const ArrowEdge = React.memo(function ArrowEdge({ sourceX, sourceY, targetX, targetY, style }) {
  const scx = sourceX, scy = sourceY + HALF // source handle is Top  → centre below it
  const tcx = targetX, tcy = targetY - HALF // target handle is Bottom → centre above it
  const dx = tcx - scx
  const dy = tcy - scy
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const sx = scx + ux * RIM
  const sy = scy + uy * RIM
  const tx = tcx - ux * RIM
  const ty = tcy - uy * RIM
  return (
    <g>
      {/* wide transparent hit target — only clickable in edit mode (CSS-gated
          by .rf-edit), so normal browsing keeps panning through edges */}
      <path className="edge-hit" d={`M ${sx},${sy} L ${tx},${ty}`} fill="none" />
      <path
        className="react-flow__edge-path"
        d={`M ${sx},${sy} L ${tx},${ty}`}
        style={style}
        fill="none"
      />
    </g>
  )
})
const edgeTypes = { arrow: ArrowEdge }

const EDGE_STYLE = {
  locked: { stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1.5 },
  unlocked: { stroke: 'rgba(250, 204, 21, 0.55)', strokeWidth: 2 },
  inprogress: { stroke: 'rgba(244, 114, 182, 0.6)', strokeWidth: 2 },
  mastered: { stroke: 'rgba(163, 230, 53, 0.7)', strokeWidth: 2.2 },
}

const FILTERS = [
  { id: 'all', label: 'all' },
  { id: 'adapting', label: 'adapting' },
  { id: 'frontier', label: 'frontier' },
  { id: 'adapted', label: 'adapted' },
]

// zoom level-of-detail: below these thresholds, labels/glow/animation are cut
// via CSS (see .rf-lod-*) — the other half of the zoom-out lag fix
function lodOf(zoom) {
  return zoom < 0.32 ? 2 : zoom < 0.55 ? 1 : 0
}

function RealmFlow({ realmId, onSelect, selectedId, filter, focus, editMode, editTool, graphReady, selIds, setSelIds }) {
  const tree = useTree()
  const { fitView, setCenter } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const lod = useStore((s) => lodOf(s.transform[2]))
  // memoised: labelsOf falls back to a fresh {}, which would otherwise re-run
  // the (expensive) layout on every single render
  const labels = useMemo(() => labelsOf(realmId, tree), [tree.labels, realmId])
  const { nodes: baseNodes, edges: baseEdges, occupied, bounds } = useMemo(
    () => layoutRealm(tree.skills, realmId, labels),
    [tree.skills, realmId, labels],
  )

  // edit-mode transient state — never touches the global store
  const [linkFrom, setLinkFrom] = useState(null) // skill id armed as prereq
  const [pendingAt, setPendingAt] = useState(null) // { q, r } the create form targets
  const [dragPos, setDragPos] = useState(null) // { [id]: { x, y } } live drag override
  const [labelEdit, setLabelEdit] = useState(null) // branch whose title is being edited
  useEffect(() => {
    if (!editMode) { setLinkFrom(null); setPendingAt(null); setDragPos(null); setLabelEdit(null) }
  }, [editMode])
  useEffect(() => { setLinkFrom(null); setLabelEdit(null) }, [editTool])

  useEffect(() => {
    if (!nodesInitialized) return
    // Two INSTANT fits — an early rough frame, then a correction once the
    // card→canvas morph has settled the container size. The old second fit was
    // a 400ms animated zoom, which made onlyRenderVisibleElements mount/unmount
    // nodes every frame (cull-thrash) right when the entrance was busiest.
    const t1 = setTimeout(() => fitView({ padding: 0.1, maxZoom: 0.95 }), 50)
    const t2 = setTimeout(() => fitView({ padding: 0.1, maxZoom: 0.95 }), 450)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [nodesInitialized, realmId, fitView])

  // search/quest jump: center on the requested node once laid out
  useEffect(() => {
    if (!focus || !nodesInitialized) return
    const n = baseNodes.find((x) => x.id === focus.id)
    if (n) setCenter(n.position.x + 26, n.position.y + 26, { zoom: 1.05, duration: 600 })
  }, [focus, nodesInitialized, baseNodes, setCenter])

  const frontierSet = useMemo(
    () => (filter === 'frontier' ? new Set(frontierSkills(tree).map((k) => k.id)) : null),
    [filter, tree.skills, tree.progress],
  )

  const byId = useMemo(
    () => Object.fromEntries(baseNodes.filter((n) => n.type === 'skill').map((n) => [n.id, n.data.skill])),
    [baseNodes],
  )

  // lattice cell (q,r) <-> node id, for drop-collision checks and for reading a
  // node's pre-drag cell back (positions come straight from axialToPixel so the
  // inverse round-trips exactly)
  const { cellId, cellOf } = useMemo(() => {
    const cellId = new Map()
    const cellOf = new Map()
    for (const n of baseNodes) {
      if (n.type !== 'skill') continue
      const { q, r } = pixelToAxial(n.position.x, -n.position.y)
      cellId.set(q + ',' + r, n.id)
      cellOf.set(n.id, { q, r })
    }
    return { cellId, cellOf }
  }, [baseNodes])

  // empty-cell ghosts, only while placing — every free (q,r) in a padded bounds
  const ghosts = useMemo(() => {
    if (!editMode || editTool !== 'place') return []
    const out = []
    for (let r = bounds.minR - 2; r <= bounds.maxR + 2; r++) {
      for (let q = bounds.minQ - 2; q <= bounds.maxQ + 2; q++) {
        if (occupied.has(q + ',' + r)) continue
        const p = axialToPixel(q, r)
        // selectable:false keeps ghosts out of box-selections; onNodeClick
        // still fires on them, which is all the place tool needs.
        out.push({
          id: `ghost-${q}-${r}`, type: 'ghost',
          position: { x: p.x, y: -p.y }, data: { q, r },
          draggable: false, selectable: false,
        })
      }
    }
    return out
  }, [editMode, editTool, occupied, bounds])

  const labelTool = editMode && editTool === 'label'

  const nodes = useMemo(() => {
    const out = []
    for (const n of baseNodes) {
      if (n.type === 'branchLabel') {
        // hidden titles only exist while the label tool is open, so they can
        // be brought back — everywhere else they're simply gone
        if (n.data.hidden && !labelTool) continue
        out.push({
          ...n,
          draggable: labelTool,
          position: dragPos?.[n.id] || n.position,
          data: { ...n.data, editable: labelTool },
        })
        continue
      }
      if (n.type !== 'skill') { out.push(n); continue }
      const skill = n.data.skill
      const status = statusOf(skill, tree.progress)
      const dim =
        filter === 'all'
          ? false
          : filter === 'adapting'
            ? !(status === 'inprogress' || status === 'unlocked')
            : filter === 'adapted'
              ? status !== 'mastered'
              : !frontierSet.has(skill.id)
      out.push({
        ...n,
        // In edit mode selIds IS the selection — onNodeClick updates it in the
        // same batch as the click, so this array never lags behind what React
        // Flow just did. (A node dragged straight from unselected counts too,
        // or it would blink off the moment the first drag frame lands here.)
        selected: editMode ? selIds.has(n.id) || !!dragPos?.[n.id] : n.id === selectedId,
        draggable: editMode && editTool === 'place',
        position: dragPos?.[n.id] || n.position,
        data: {
          ...n.data,
          status,
          burst: burstOf(skill.id),
          adapt: rec(skill.id).adapt || 0,
          dim,
          linkArmed: linkFrom === n.id,
        },
      })
    }
    return editMode ? [...out, ...ghosts] : out
  }, [baseNodes, selectedId, selIds, tree.progress, filter, frontierSet, editMode, editTool, labelTool, linkFrom, dragPos, ghosts])

  const edges = useMemo(() => baseEdges.map((e) => {
    const st = statusOf(byId[e.source], tree.progress)
    return {
      ...e,
      // The lattice grid itself shows the links now (connected skills sit on
      // adjacent lattice points, so the grid segment between them IS the edge),
      // so drawn edges stay hidden until you select a skill — then its lineage
      // lights up over the grid. Edit mode shows all so they can be unlinked.
      // Bonus: nothing selected ⇒ zero edge DOM, which is most of the load cost.
      hidden: !editMode && e.source !== selectedId && e.target !== selectedId,
      style: { ...EDGE_STYLE[st], ...(e.data.cross ? { strokeDasharray: '4 7', opacity: 0.85 } : {}) },
    }
  }), [baseEdges, byId, tree.progress, selectedId, editMode])

  // walk fromId's prereq closure — used to reject a link that would cycle
  const reqReaches = useCallback((fromId, targetId) => {
    const stack = [fromId], seen = new Set()
    while (stack.length) {
      const cur = stack.pop()
      if (cur === targetId) return true
      if (seen.has(cur)) continue
      seen.add(cur)
      for (const r of byId[cur]?.req || []) stack.push(r)
    }
    return false
  }, [byId])

  const onNodeClick = useCallback((e, node) => {
    if (node.type === 'ghost') {
      if (editMode && editTool === 'place') setPendingAt({ q: node.data.q, r: node.data.r })
      return
    }
    if (node.type === 'branchLabel') {
      if (labelTool) setLabelEdit(node.data.label)
      return
    }
    if (node.type !== 'skill') return
    if (editMode && editTool === 'link') {
      const id = node.id
      if (!linkFrom) { setLinkFrom(id); return }
      if (linkFrom === id) { setLinkFrom(null); return }
      const A = linkFrom, B = id // A becomes a prereq of B (edge A→B)
      const curReq = byId[B]?.req || []
      // skip no-ops and anything that would create a prereq cycle
      if (!curReq.includes(A) && !reqReaches(A, B)) updateSkillReq(realmId, B, [...curReq, A])
      setLinkFrom(null)
      return
    }
    // Drive the selection ourselves rather than mirroring React Flow's after
    // the fact: onSelectionChange lands a render late, so a plain click (which
    // REPLACES the selection) would otherwise be re-read as an add and the
    // previous node would stay selected.
    const adding = e.ctrlKey || e.metaKey || e.shiftKey
    if (editMode) {
      setSelIds((prev) => {
        if (!adding) return new Set([node.id])
        const next = new Set(prev)
        if (next.has(node.id)) next.delete(node.id)
        else next.add(node.id)
        return next
      })
    }
    // a modifier click is building a multi-selection, not asking for the panel
    if (adding) return
    onSelect(node.data.skill)
  }, [editMode, editTool, labelTool, linkFrom, byId, reqReaches, realmId, onSelect, setSelIds])

  // React Flow owns selection (click, ctrl-click, shift-drag box); we mirror it
  // so the delete action and the node styling can read it. Guarded against
  // no-op updates, since this fires on every store selection touch.
  // Clicks maintain selIds themselves (see onNodeClick); this only has to catch
  // the selections React Flow makes on its own — shift-drag marquee, and the
  // node it auto-selects when you start dragging an unselected one.
  const onSelectionChange = useCallback(({ nodes: sel }) => {
    const next = new Set(sel.filter((n) => n.type === 'skill').map((n) => n.id))
    setSelIds((prev) => (prev.size === next.size && [...next].every((id) => prev.has(id)) ? prev : next))
  }, [setSelIds])

  const onNodeDrag = useCallback((_, node, dragged) => {
    const list = dragged?.length ? dragged : [node]
    const next = {}
    for (const n of list) next[n.id] = { x: n.position.x, y: n.position.y }
    setDragPos(next)
  }, [])

  const onNodeDragStop = useCallback((_, node, dragged) => {
    setDragPos(null)
    // titles live in free pixel space — no lattice, no collision rules
    if (node.type === 'branchLabel') {
      setBranchLabel(realmId, node.data.label, {
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
      })
      return
    }
    const list = (dragged?.length ? dragged : [node]).filter((n) => n.type === 'skill')
    const from = cellOf.get(node.id)
    if (!list.length || !from) return

    // The node under the cursor decides the lattice step; every other node in
    // the selection takes the SAME (dq, dr). Snapping each one independently
    // would shear the group apart — this way the arrangement is rigid.
    const to = pixelToAxial(node.position.x, -node.position.y)
    const dq = to.q - from.q
    const dr = to.r - from.r
    if (!dq && !dr) return // same cell → no-op, and no vault write

    const moving = new Set(list.map((n) => n.id))
    const moves = []
    for (const n of list) {
      const c = cellOf.get(n.id)
      if (!c) return
      const pos = { q: c.q + dq, r: c.r + dr }
      const occupant = cellId.get(pos.q + ',' + pos.r)
      // a landing cell held by anything outside the group → the WHOLE group
      // springs back, so a move is all-or-nothing rather than half-applied
      if (occupant && !moving.has(occupant)) return
      moves.push({ id: n.id, pos })
    }
    moveSkills(realmId, moves)
  }, [cellId, cellOf, realmId])

  const onEdgeClick = useCallback((_, edge) => {
    if (!editMode) return
    const curReq = byId[edge.target]?.req || []
    updateSkillReq(realmId, edge.target, curReq.filter((r) => r !== edge.source))
  }, [editMode, byId, realmId])

  const branches = useMemo(
    () => [...new Set(tree.skills.filter((s) => s.realm === realmId).map((s) => s.branch))],
    [tree.skills, realmId],
  )

  return (
    <>
      {/* Always on, even before the graph mounts — the lattice appears the
          instant the card→canvas morph starts, then nodes pop onto it once
          ready, reading as a build-up rather than a stall. */}
      <LatticeBackground />
      {graphReady && (
        <ReactFlow
          className={`rf-mount-in rf-lod-${lod} ${editMode ? 'rf-edit' : ''} ${editMode && editTool === 'link' ? 'rf-link' : ''} ${labelTool ? 'rf-label' : ''}`}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onSelectionChange={onSelectionChange}
          onEdgeClick={onEdgeClick}
          onPaneClick={() => { onSelect(null); setLinkFrom(null); setSelIds(new Set()) }}
          fitView
          fitViewOptions={{ padding: 0.1, maxZoom: 0.95 }}
          minZoom={0.1}
          maxZoom={2}
          nodesDraggable={editMode && (editTool === 'place' || editTool === 'label')}
          nodesConnectable={false}
          edgesFocusable={editMode}
          // Delete/Backspace is handled by Realm's own listener so it can run
          // through the confirm step — React Flow's built-in would drop nodes
          // from its internal store without ever reaching the vault.
          deleteKeyCode={null}
          onlyRenderVisibleElements
          proOptions={{ hideAttribution: true }}
        />
      )}
      {pendingAt && (
        <SkillEditor realmId={realmId} at={pendingAt} branches={branches} onClose={() => setPendingAt(null)} />
      )}
      {labelEdit && (
        <BranchLabelEditor
          realmId={realmId}
          branch={labelEdit}
          override={labels[labelEdit] || {}}
          onClose={() => setLabelEdit(null)}
        />
      )}
    </>
  )
}

// Deleting a skill is the one edit that can't be undone by dragging something
// back, so it always goes through this — naming what's about to go.
function DeleteConfirm({ skills, onCancel, onConfirm }) {
  return (
    <Modal onClose={onCancel}>
      <form
        className="skill-editor"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); onConfirm() }}
      >
        <h3 className="skill-editor-title">Delete {skills.length === 1 ? 'skill' : `${skills.length} skills`}?</h3>
        <ul className="skill-editor-list">
          {skills.slice(0, 12).map((s) => (
            <li key={s.id}>{s.icon || '◆'} {s.name}</li>
          ))}
          {skills.length > 12 && <li className="more">…and {skills.length - 12} more</li>}
        </ul>
        <p className="skill-editor-hint">
          Any prerequisite link pointing at {skills.length === 1 ? 'it' : 'them'} is severed too.
          Tracked progress is kept, in case this was a mistake.
        </p>
        <div className="skill-editor-actions">
          <button type="button" className="realm-filter" onClick={onCancel}>cancel</button>
          <button type="submit" className="realm-filter danger" autoFocus>delete</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Realm({ realmId, onSelect, selectedId, focus, graphReady = true }) {
  const tree = useTree()
  const realm = tree.realms.find((r) => r.id === realmId)
  const [filter, setFilter] = useState('all')
  const [editMode, setEditMode] = useState(false)
  const [editTool, setEditTool] = useState('place') // 'place' | 'link' | 'label'
  const [selIds, setSelIds] = useState(() => new Set()) // multi-selection (edit mode)
  const [confirmDel, setConfirmDel] = useState(null) // skills queued for deletion
  const canEdit = tree.syncStatus === 'ready' // only editable against a live vault
  const editing = editMode && canEdit
  useEffect(() => { if (!canEdit) setEditMode(false) }, [canEdit])
  useEffect(() => { if (!editing) { setSelIds(new Set()); setConfirmDel(null) } }, [editing])

  const askDelete = useCallback(() => {
    const picked = tree.skills.filter((s) => s.realm === realmId && selIds.has(s.id))
    if (picked.length) setConfirmDel(picked)
  }, [tree.skills, realmId, selIds])

  const doDelete = useCallback(() => {
    const ids = confirmDel.map((s) => s.id)
    deleteSkills(realmId, ids)
    if (ids.includes(selectedId)) onSelect(null)
    setSelIds(new Set())
    setConfirmDel(null)
  }, [confirmDel, realmId, selectedId, onSelect])

  // Delete/Backspace on the selection. Ignored while a form has focus so it
  // stays an ordinary editing key inside the create/rename dialogs.
  useEffect(() => {
    if (!editing) return
    const onKey = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (!selIds.size || confirmDel) return
      e.preventDefault()
      askDelete()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, selIds, confirmDel, askDelete])

  return (
    <div className="realm-canvas">
      <ReactFlowProvider>
        <RealmFlow
          realmId={realmId}
          onSelect={onSelect}
          selectedId={selectedId}
          filter={filter}
          focus={focus}
          editMode={editing}
          editTool={editTool}
          graphReady={graphReady}
          selIds={selIds}
          setSelIds={setSelIds}
        />
      </ReactFlowProvider>
      {confirmDel && (
        <DeleteConfirm skills={confirmDel} onCancel={() => setConfirmDel(null)} onConfirm={doDelete} />
      )}
      <div className="realm-hud">
        <h2 className="realm-hud-name"><ScrambleText text={realm?.name || ''} /></h2>
        {realm?.end && <p className="realm-hud-end">🏁 {realm.end}</p>}
        <div className="realm-filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`realm-filter ${filter === f.id ? 'on' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          <button
            className={`realm-filter edit-toggle ${editMode ? 'on' : ''}`}
            onClick={() => canEdit && setEditMode((e) => !e)}
            disabled={!canEdit}
            title={canEdit ? 'Toggle edit mode' : 'Connect the vault to edit skills'}
          >
            ✎ edit
          </button>
          {editing && (
            <>
              <button
                className={`realm-filter ${editTool === 'place' ? 'on' : ''}`}
                onClick={() => setEditTool('place')}
                title="Click empty cells to add skills; drag to reposition (shift-drag or ctrl-click to grab several)"
              >
                place
              </button>
              <button
                className={`realm-filter ${editTool === 'link' ? 'on' : ''}`}
                onClick={() => setEditTool('link')}
                title="Click a prereq then a dependent to link; click an edge to unlink"
              >
                link
              </button>
              <button
                className={`realm-filter ${editTool === 'label' ? 'on' : ''}`}
                onClick={() => setEditTool('label')}
                title="Drag branch titles to move them; click one to rename or hide it"
              >
                titles
              </button>
              <button
                className="realm-filter danger"
                onClick={askDelete}
                disabled={!selIds.size}
                title={selIds.size ? 'Delete the selected skills (Del)' : 'Select skills first — click, ctrl-click, or shift-drag a box'}
              >
                delete{selIds.size > 1 ? ` ${selIds.size}` : ''}
              </button>
            </>
          )}
        </div>
        {editing && (
          <p className="realm-edit-hint">
            {editTool === 'place'
              ? 'drag to move · ctrl-click or shift-drag a box for several · Del to remove'
              : editTool === 'link'
                ? 'click a prereq then its dependent · click a line to unlink'
                : 'drag a title to move it · click a title to rename or hide it'}
          </p>
        )}
        <div className="realm-hud-legend">
          <span><i className="sw locked" /> sealed</span>
          <span><i className="sw unlocked" /> awakened</span>
          <span><i className="sw inprogress" /> adapting</span>
          <span><i className="sw mastered" /> adapted</span>
        </div>
      </div>
    </div>
  )
}
