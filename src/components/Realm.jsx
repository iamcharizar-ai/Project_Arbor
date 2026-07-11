import React, { useMemo, useCallback, useEffect } from 'react'
import { ReactFlow, Background, Handle, Position, useReactFlow, useNodesInitialized, ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { layoutRealm } from '../lib/layout.js'
import { useTree, statusOf, valueOf, burstOf } from '../lib/store.js'
import { ScrambleText } from './fx.jsx'

// WINGS-style node: icon circle + status ring, name beneath.
function SkillNode({ data, selected }) {
  const skill = data.skill
  const status = statusOf(skill)
  const burst = burstOf(skill.id)
  const val = valueOf(skill)
  const sub = skill.unit ? `${val}/${skill.t[2]} ${skill.unit}` : null
  return (
    <div className={`sk ${status} ${selected ? 'selected' : ''}`} style={{ '--d': data.depth }} title={skill.note || skill.name}>
      <Handle type="target" position={Position.Bottom} className="handle" />
      <Handle type="source" position={Position.Top} className="handle" />
      <div className="sk-circle">
        {burst > 0 && <span className="burst" key={burst} />}
        <span className="sk-icon">{skill.icon || '◆'}</span>
        {skill.star && <span className="sk-star">✦</span>}
      </div>
      <span className="sk-label">{skill.name}</span>
      {sub && <span className="sk-sub">{sub}</span>}
    </div>
  )
}

function BranchLabel({ data }) {
  return <div className="branch-label">{data.label}</div>
}

const nodeTypes = { skill: SkillNode, branchLabel: BranchLabel }

const EDGE_STYLE = {
  locked: { stroke: 'rgba(255,255,255,0.10)', strokeWidth: 1.2 },
  unlocked: { stroke: 'rgba(180, 215, 170, 0.5)', strokeWidth: 1.5 },
  inprogress: { stroke: 'rgba(226, 167, 94, 0.6)', strokeWidth: 1.5 },
  mastered: { stroke: 'rgba(236, 198, 101, 0.7)', strokeWidth: 1.7 },
}

function RealmFlow({ realmId, onSelect, selectedId }) {
  const tree = useTree()
  const { fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const { nodes: baseNodes, edges: baseEdges } = useMemo(() => layoutRealm(tree.skills, realmId), [tree.skills, realmId])

  useEffect(() => {
    if (!nodesInitialized) return
    const t1 = setTimeout(() => fitView({ padding: 0.1, maxZoom: 0.95 }), 50)
    const t2 = setTimeout(() => fitView({ padding: 0.1, maxZoom: 0.95, duration: 400 }), 350)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [nodesInitialized, realmId, fitView])

  const nodes = useMemo(
    () => baseNodes.map((n) => ({ ...n, selected: n.id === selectedId })),
    [baseNodes, selectedId, tree.progress],
  )
  const byId = useMemo(
    () => Object.fromEntries(baseNodes.filter((n) => n.type === 'skill').map((n) => [n.id, n.data.skill])),
    [baseNodes],
  )
  const edges = useMemo(() => baseEdges.map((e) => {
    const st = statusOf(byId[e.source])
    return {
      ...e,
      animated: st === 'inprogress',
      style: { ...EDGE_STYLE[st], ...(e.data.cross ? { strokeDasharray: '4 7', opacity: 0.55 } : {}) },
    }
  }), [baseEdges, byId, tree.progress])

  const onNodeClick = useCallback((_, node) => {
    if (node.type === 'skill') onSelect(node.data.skill)
  }, [onSelect])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onPaneClick={() => onSelect(null)}
      fitView
      fitViewOptions={{ padding: 0.1, maxZoom: 0.95 }}
      minZoom={0.1}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant="dots" gap={38} size={1} color="rgba(255,255,255,0.05)" />
    </ReactFlow>
  )
}

export default function Realm({ realmId, onSelect, selectedId }) {
  const tree = useTree()
  const realm = tree.realms.find((r) => r.id === realmId)
  return (
    <div className="realm-canvas">
      <ReactFlowProvider>
        <RealmFlow realmId={realmId} onSelect={onSelect} selectedId={selectedId} />
      </ReactFlowProvider>
      <div className="realm-hud">
        <h2 className="realm-hud-name"><ScrambleText text={realm?.name || ''} /></h2>
        {realm?.end && <p className="realm-hud-end">🏁 {realm.end}</p>}
        <div className="realm-hud-legend">
          <span><i className="sw locked" /> locked</span>
          <span><i className="sw unlocked" /> unlocked</span>
          <span><i className="sw inprogress" /> in progress</span>
          <span><i className="sw mastered" /> mastered</span>
        </div>
      </div>
    </div>
  )
}
