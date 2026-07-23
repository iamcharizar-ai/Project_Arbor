import React, { useMemo, useCallback, useEffect, useState } from 'react'
import { ReactFlow, Handle, Position, useReactFlow, useNodesInitialized, ReactFlowProvider, useStore } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { layoutRealm, axialToPixel, pixelToAxial } from '../lib/layout.js'
import { useTree, statusOf, burstOf, rec, frontierSkills, moveSkill, updateSkillReq } from '../lib/store.js'
import { ScrambleText } from './fx.jsx'
import LatticeBackground from './LatticeBackground.jsx'
import SkillEditor from './SkillEditor.jsx'

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

function BranchLabel({ data }) {
  return <div className="branch-label">{data.label}</div>
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

function RealmFlow({ realmId, onSelect, selectedId, filter, focus, editMode, editTool, graphReady }) {
  const tree = useTree()
  const { fitView, setCenter } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const lod = useStore((s) => lodOf(s.transform[2]))
  const { nodes: baseNodes, edges: baseEdges, occupied, bounds } = useMemo(
    () => layoutRealm(tree.skills, realmId),
    [tree.skills, realmId],
  )

  // edit-mode transient state — never touches the global store
  const [linkFrom, setLinkFrom] = useState(null) // skill id armed as prereq
  const [pendingAt, setPendingAt] = useState(null) // { q, r } the create form targets
  const [dragPos, setDragPos] = useState(null) // { id, x, y } live drag override
  useEffect(() => { if (!editMode) { setLinkFrom(null); setPendingAt(null); setDragPos(null) } }, [editMode])
  useEffect(() => { setLinkFrom(null) }, [editTool])

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

  // lattice cell (q,r) -> node id, for drop-collision checks (positions come
  // straight from axialToPixel so the inverse round-trips exactly)
  const cellId = useMemo(() => {
    const m = new Map()
    for (const n of baseNodes) {
      if (n.type !== 'skill') continue
      const { q, r } = pixelToAxial(n.position.x, -n.position.y)
      m.set(q + ',' + r, n.id)
    }
    return m
  }, [baseNodes])

  // empty-cell ghosts, only while placing — every free (q,r) in a padded bounds
  const ghosts = useMemo(() => {
    if (!editMode || editTool !== 'place') return []
    const out = []
    for (let r = bounds.minR - 2; r <= bounds.maxR + 2; r++) {
      for (let q = bounds.minQ - 2; q <= bounds.maxQ + 2; q++) {
        if (occupied.has(q + ',' + r)) continue
        const p = axialToPixel(q, r)
        out.push({
          id: `ghost-${q}-${r}`, type: 'ghost',
          position: { x: p.x, y: -p.y }, data: { q, r },
          draggable: false, selectable: true,
        })
      }
    }
    return out
  }, [editMode, editTool, occupied, bounds])

  const nodes = useMemo(() => {
    const skillNodes = baseNodes.map((n) => {
      if (n.type !== 'skill') return n
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
      const node = {
        ...n,
        selected: n.id === selectedId,
        draggable: editMode && editTool === 'place',
        data: {
          ...n.data,
          status,
          burst: burstOf(skill.id),
          adapt: rec(skill.id).adapt || 0,
          dim,
          linkArmed: linkFrom === n.id,
        },
      }
      if (dragPos && dragPos.id === n.id) node.position = { x: dragPos.x, y: dragPos.y }
      return node
    })
    return editMode ? [...skillNodes, ...ghosts] : skillNodes
  }, [baseNodes, selectedId, tree.progress, filter, frontierSet, editMode, editTool, linkFrom, dragPos, ghosts])

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

  const onNodeClick = useCallback((_, node) => {
    if (node.type === 'ghost') {
      if (editMode && editTool === 'place') setPendingAt({ q: node.data.q, r: node.data.r })
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
    onSelect(node.data.skill)
  }, [editMode, editTool, linkFrom, byId, reqReaches, realmId, onSelect])

  const onNodeDrag = useCallback((_, node) => {
    if (node.type === 'skill') setDragPos({ id: node.id, x: node.position.x, y: node.position.y })
  }, [])

  const onNodeDragStop = useCallback((_, node) => {
    setDragPos(null)
    if (node.type !== 'skill') return
    const snap = pixelToAxial(node.position.x, -node.position.y)
    const occupant = cellId.get(snap.q + ',' + snap.r)
    // empty cell → move; own cell (no-op) or another node's cell → spring back,
    // no vault write either way
    if (occupant) return
    moveSkill(realmId, node.id, snap)
  }, [cellId, realmId])

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
          className={`rf-mount-in rf-lod-${lod} ${editMode ? 'rf-edit' : ''} ${editMode && editTool === 'link' ? 'rf-link' : ''}`}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onEdgeClick={onEdgeClick}
          onPaneClick={() => { onSelect(null); setLinkFrom(null) }}
          fitView
          fitViewOptions={{ padding: 0.1, maxZoom: 0.95 }}
          minZoom={0.1}
          maxZoom={2}
          nodesDraggable={editMode && editTool === 'place'}
          nodesConnectable={false}
          edgesFocusable={editMode}
          onlyRenderVisibleElements
          proOptions={{ hideAttribution: true }}
        />
      )}
      {pendingAt && (
        <SkillEditor realmId={realmId} at={pendingAt} branches={branches} onClose={() => setPendingAt(null)} />
      )}
    </>
  )
}

export default function Realm({ realmId, onSelect, selectedId, focus, graphReady = true }) {
  const tree = useTree()
  const realm = tree.realms.find((r) => r.id === realmId)
  const [filter, setFilter] = useState('all')
  const [editMode, setEditMode] = useState(false)
  const [editTool, setEditTool] = useState('place') // 'place' | 'link'
  const canEdit = tree.syncStatus === 'ready' // only editable against a live vault
  useEffect(() => { if (!canEdit) setEditMode(false) }, [canEdit])
  return (
    <div className="realm-canvas">
      <ReactFlowProvider>
        <RealmFlow
          realmId={realmId}
          onSelect={onSelect}
          selectedId={selectedId}
          filter={filter}
          focus={focus}
          editMode={editMode && canEdit}
          editTool={editTool}
          graphReady={graphReady}
        />
      </ReactFlowProvider>
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
          {editMode && canEdit && (
            <>
              <button
                className={`realm-filter ${editTool === 'place' ? 'on' : ''}`}
                onClick={() => setEditTool('place')}
                title="Click empty cells to add skills; drag skills to reposition"
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
            </>
          )}
        </div>
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
