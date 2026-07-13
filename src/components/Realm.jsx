import React, { useMemo, useCallback, useEffect, useState } from 'react'
import { ReactFlow, Background, Handle, Position, useReactFlow, useNodesInitialized, ReactFlowProvider, useStore } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { layoutRealm } from '../lib/layout.js'
import { useTree, statusOf, burstOf, rec, frontierSkills } from '../lib/store.js'
import { ScrambleText } from './fx.jsx'

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
        className={`sk ${data.status} ${selected ? 'selected' : ''} ${data.dim ? 'dim' : ''}`}
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
    a.data.dim === b.data.dim,
)

function BranchLabel({ data }) {
  return <div className="branch-label">{data.label}</div>
}

const nodeTypes = { skill: SkillNode, branchLabel: BranchLabel }

// WINGS-style edge: straight line with a small direction arrow midway.
// Static SVG — no marching-ants animation (pure lag, no information).
// Endpoints arrive at the circle CENTERS (see SkillNode handles) and get
// trimmed back by R so the line starts/ends on the rim — on diagonal links
// that's exactly the circle's 45° point, giving the symmetric diamond look.
const RIM = 30 // circle radius (26) + breathing room
const ArrowEdge = React.memo(function ArrowEdge({ sourceX, sourceY, targetX, targetY, style }) {
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const sx = sourceX + ux * RIM
  const sy = sourceY + uy * RIM
  const tx = targetX - ux * RIM
  const ty = targetY - uy * RIM
  const mx = (sx + tx) / 2
  const my = (sy + ty) / 2
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI
  return (
    <g>
      <path
        className="react-flow__edge-path"
        d={`M ${sx},${sy} L ${tx},${ty}`}
        style={style}
        fill="none"
      />
      <polygon
        className="edge-arrow"
        points="-4,-3.2 4.6,0 -4,3.2"
        transform={`translate(${mx}, ${my}) rotate(${ang})`}
        fill={style?.stroke || 'rgba(232,230,225,0.3)'}
      />
    </g>
  )
})
const edgeTypes = { arrow: ArrowEdge }

const EDGE_STYLE = {
  locked: { stroke: 'rgba(232,230,225,0.09)', strokeWidth: 1.2 },
  unlocked: { stroke: 'rgba(203,213,209,0.45)', strokeWidth: 1.5 },
  inprogress: { stroke: 'rgba(154,140,245,0.55)', strokeWidth: 1.5 },
  mastered: { stroke: 'rgba(224,195,106,0.7)', strokeWidth: 1.7 },
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

function RealmFlow({ realmId, onSelect, selectedId, filter, focus }) {
  const tree = useTree()
  const { fitView, setCenter } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const lod = useStore((s) => lodOf(s.transform[2]))
  const { nodes: baseNodes, edges: baseEdges } = useMemo(() => layoutRealm(tree.skills, realmId), [tree.skills, realmId])

  useEffect(() => {
    if (!nodesInitialized) return
    const t1 = setTimeout(() => fitView({ padding: 0.1, maxZoom: 0.95 }), 50)
    const t2 = setTimeout(() => fitView({ padding: 0.1, maxZoom: 0.95, duration: 400 }), 350)
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

  const nodes = useMemo(() => {
    return baseNodes.map((n) => {
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
      return {
        ...n,
        selected: n.id === selectedId,
        data: {
          ...n.data,
          status,
          burst: burstOf(skill.id),
          adapt: rec(skill.id).adapt || 0,
          dim,
        },
      }
    })
  }, [baseNodes, selectedId, tree.progress, filter, frontierSet])

  const byId = useMemo(
    () => Object.fromEntries(baseNodes.filter((n) => n.type === 'skill').map((n) => [n.id, n.data.skill])),
    [baseNodes],
  )
  const edges = useMemo(() => baseEdges.map((e) => {
    const st = statusOf(byId[e.source], tree.progress)
    return {
      ...e,
      // WINGS keeps trees visually independent — cross-branch prereq edges
      // only materialize when one of their endpoints is selected
      hidden: e.data.cross && e.source !== selectedId && e.target !== selectedId,
      style: { ...EDGE_STYLE[st], ...(e.data.cross ? { strokeDasharray: '4 7', opacity: 0.85 } : {}) },
    }
  }), [baseEdges, byId, tree.progress, selectedId])

  const onNodeClick = useCallback((_, node) => {
    if (node.type === 'skill') onSelect(node.data.skill)
  }, [onSelect])

  return (
    <ReactFlow
      className={`rf-lod-${lod}`}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={onNodeClick}
      onPaneClick={() => onSelect(null)}
      fitView
      fitViewOptions={{ padding: 0.1, maxZoom: 0.95 }}
      minZoom={0.1}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      onlyRenderVisibleElements
      proOptions={{ hideAttribution: true }}
    >
      <Background variant="dots" gap={38} size={1} color="rgba(232,230,225,0.05)" />
    </ReactFlow>
  )
}

export default function Realm({ realmId, onSelect, selectedId, focus }) {
  const tree = useTree()
  const realm = tree.realms.find((r) => r.id === realmId)
  const [filter, setFilter] = useState('all')
  return (
    <div className="realm-canvas">
      <ReactFlowProvider>
        <RealmFlow realmId={realmId} onSelect={onSelect} selectedId={selectedId} filter={filter} focus={focus} />
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
