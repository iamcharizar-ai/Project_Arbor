import React, { useMemo, useCallback, useEffect } from 'react'
import { ReactFlow, Handle, Position, useReactFlow, useNodesInitialized, ReactFlowProvider, useStore } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { layoutTree, NODE } from '../lib/layout.js'
import { useTree, statusOf, burstOf, rec, frontierSkills } from '../lib/store.js'

const HALF = NODE / 2
const RIM = NODE / 2

const SkillNode = React.memo(
  function SkillNode({ data, selected }) {
    const skill = data.skill
    return (
      <div
        className={`sk ${data.status} ${selected ? 'selected' : ''} ${data.dim ? 'dim' : ''}`}
        title={skill.name}
      >
        <Handle type="target" position={Position.Bottom} className="handle" />
        <Handle type="source" position={Position.Top} className="handle" />
        <div className="sk-circle">
          {data.burst > 0 && <span className="burst" key={data.burst} />}
          <span className="sk-icon">{skill.icon || '◆'}</span>
          {skill.star && <span className="sk-star">✦</span>}
          {data.adapt > 0 && <span className="sk-adapt" title={`climbed back ×${data.adapt}`}>⚙</span>}
        </div>
        <span className="sk-name">{skill.name}</span>
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
  return (
    <div className={`branch-label fam-${data.family || 'cal'} ${data.dim ? 'dim' : ''}`}>
      {data.label}
    </div>
  )
}

const nodeTypes = { skill: SkillNode, branchLabel: BranchLabel }

const ArrowEdge = React.memo(function ArrowEdge({ sourceX, sourceY, targetX, targetY, style, data }) {
  const scx = sourceX
  const scy = sourceY + HALF
  const tcx = targetX
  const tcy = targetY - HALF
  const dx = tcx - scx
  const dy = tcy - scy
  const len = Math.hypot(dx, dy) || 1
  const sx = scx + (dx / len) * RIM
  const sy = scy + (dy / len) * RIM
  const tx = tcx - (dx / len) * RIM
  const ty = tcy - (dy / len) * RIM
  return (
    <path
      className={`react-flow__edge-path ${data?.cross ? 'edge-cross' : ''}`}
      d={`M ${sx},${sy} L ${tx},${ty}`}
      style={style}
      fill="none"
    />
  )
})
const edgeTypes = { arrow: ArrowEdge }

const EDGE_STYLE = {
  locked: { stroke: 'rgba(255,255,255,0.10)', strokeWidth: 1.4 },
  unlocked: { stroke: 'rgba(250, 204, 21, 0.55)', strokeWidth: 2 },
  inprogress: { stroke: 'rgba(244, 114, 182, 0.65)', strokeWidth: 2 },
  mastered: { stroke: 'rgba(163, 230, 53, 0.7)', strokeWidth: 2.2 },
}

const FILTERS = [
  { id: 'all', label: 'all' },
  { id: 'cal', label: 'calisthenics' },
  { id: 'mob', label: 'mobility' },
  { id: 'mov', label: 'movement' },
  { id: 'next', label: 'next' },
  { id: 'training', label: 'training' },
  { id: 'mastered', label: 'mastered' },
]

function lodOf(zoom) {
  return zoom < 0.28 ? 2 : zoom < 0.52 ? 1 : 0
}

function TreeFlow({ onSelect, selectedId, filter, focus }) {
  const tree = useTree()
  const { fitView, setCenter } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const lod = useStore((s) => lodOf(s.transform[2]))

  const { nodes: baseNodes, edges: baseEdges } = useMemo(
    () => layoutTree(tree.skills),
    [tree.skills],
  )

  useEffect(() => {
    if (!nodesInitialized) return
    const t = setTimeout(() => fitView({ padding: 0.14, maxZoom: 0.85 }), 40)
    return () => clearTimeout(t)
  }, [nodesInitialized, fitView])

  useEffect(() => {
    if (!focus || !nodesInitialized) return
    const n = baseNodes.find((x) => x.id === focus.id)
    if (n) setCenter(n.position.x + HALF, n.position.y + HALF, { zoom: 1.05, duration: 450 })
  }, [focus, nodesInitialized, baseNodes, setCenter])

  const frontierSet = useMemo(
    () => (filter === 'next' ? new Set(frontierSkills(tree).map((k) => k.id)) : null),
    [filter, tree.skills, tree.progress],
  )

  const byId = useMemo(
    () => Object.fromEntries(baseNodes.filter((n) => n.type === 'skill').map((n) => [n.id, n.data.skill])),
    [baseNodes],
  )

  const nodes = useMemo(() => {
    return baseNodes.map((n) => {
      if (n.type === 'branchLabel') {
        const dim = filter === 'cal' || filter === 'mob' || filter === 'mov'
          ? n.data.family !== filter
          : false
        return { ...n, data: { ...n.data, dim } }
      }
      const skill = n.data.skill
      const status = statusOf(skill, tree.progress)
      let dim = false
      if (filter === 'cal' || filter === 'mob' || filter === 'mov') dim = skill.family !== filter
      else if (filter === 'training') dim = !(status === 'inprogress' || status === 'unlocked')
      else if (filter === 'mastered') dim = status !== 'mastered'
      else if (filter === 'next') dim = !frontierSet.has(skill.id)
      return {
        ...n,
        selected: n.id === selectedId,
        draggable: false,
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

  const edges = useMemo(() => baseEdges.map((e) => {
    const src = byId[e.source]
    const st = src ? statusOf(src, tree.progress) : 'locked'
    const lit = e.source === selectedId || e.target === selectedId
    const hideCross = e.data.cross && !lit && lod > 0
    return {
      ...e,
      hidden: hideCross,
      style: {
        ...EDGE_STYLE[st],
        ...(e.data.cross ? { strokeDasharray: '5 7', opacity: lit ? 0.9 : 0.45 } : {}),
        ...(lit ? { strokeWidth: 2.6 } : {}),
      },
    }
  }), [baseEdges, byId, tree.progress, selectedId, lod])

  const onNodeClick = useCallback((_, node) => {
    if (node.type !== 'skill') return
    onSelect(node.data.skill)
  }, [onSelect])

  return (
    <ReactFlow
      className={`rf-mount-in rf-lod-${lod}`}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={onNodeClick}
      onPaneClick={() => onSelect(null)}
      fitView
      fitViewOptions={{ padding: 0.14, maxZoom: 0.85 }}
      minZoom={0.12}
      maxZoom={1.8}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      onlyRenderVisibleElements
      proOptions={{ hideAttribution: true }}
      panOnDrag
      zoomOnScroll
      zoomOnPinch
    />
  )
}

export default function Tree({ onSelect, selectedId, focus, filter, onFilter }) {
  return (
    <div className="realm-canvas">
      <ReactFlowProvider>
        <TreeFlow onSelect={onSelect} selectedId={selectedId} filter={filter} focus={focus} />
      </ReactFlowProvider>
      <div className="realm-hud">
        <h2 className="realm-hud-name">Skill tree</h2>
        <p className="realm-hud-end">Pan · scroll to zoom · click a node to log a PR</p>
        <div className="realm-filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`realm-filter ${filter === f.id ? 'on' : ''}`}
              onClick={() => onFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="realm-hud-legend">
          <span><i className="sw locked" /> locked</span>
          <span><i className="sw unlocked" /> available</span>
          <span><i className="sw inprogress" /> training</span>
          <span><i className="sw mastered" /> mastered</span>
        </div>
      </div>
    </div>
  )
}
