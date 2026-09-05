// Columnar progression layout — Wings-style.
// Each branch is a vertical column: roots at the bottom, harder skills above.
// Intra-branch depth uses only same-branch prerequisites so a column reads as
// one clear difficulty ladder. Cross-branch reqs still draw as edges.

export const NODE = 88
export const COL_GAP = 96
export const FAMILY_GAP = 64
export const ROW_H = 168
export const SIB_GAP = 28

// Wings pillars first (the six body-skill columns), then mobility + movement.
const BRANCH_ORDER = [
  'Physical Foundations',
  'Horizontal Push',
  'Vertical Push',
  'Horizontal Pull',
  'Vertical Pull',
  'Core',
  'Legs',
  'Mobility Foundations',
  'Flexibility',
  'Arm Balances',
  'Yoga Holds',
  'Acrobatics Foundations',
  'Kicks',
  'Flips & Twists',
  'Breaking',
  'Dance',
]

const FAMILY_OF_BRANCH = {
  'Physical Foundations': 'cal',
  'Horizontal Push': 'cal',
  'Vertical Push': 'cal',
  'Horizontal Pull': 'cal',
  'Vertical Pull': 'cal',
  'Core': 'cal',
  'Legs': 'cal',
  'Mobility Foundations': 'mob',
  'Flexibility': 'mob',
  'Arm Balances': 'mob',
  'Yoga Holds': 'mob',
  'Acrobatics Foundations': 'mov',
  'Kicks': 'mov',
  'Flips & Twists': 'mov',
  'Breaking': 'mov',
  'Dance': 'mov',
}

function branchDepth(members) {
  const ids = new Set(members.map((s) => s.id))
  const byId = Object.fromEntries(members.map((s) => [s.id, s]))
  const depth = {}
  const visiting = new Set()
  const of = (id) => {
    if (depth[id] != null) return depth[id]
    if (visiting.has(id)) return 0
    visiting.add(id)
    const local = (byId[id]?.req || []).filter((r) => ids.has(r))
    depth[id] = local.length ? 1 + Math.max(...local.map(of)) : 0
    visiting.delete(id)
    return depth[id]
  }
  for (const s of members) of(s.id)
  return depth
}

export function layoutTree(skills) {
  const byId = Object.fromEntries(skills.map((s) => [s.id, s]))
  const present = new Set(skills.map((s) => s.branch))
  const branches = [
    ...BRANCH_ORDER.filter((b) => present.has(b)),
    ...[...present].filter((b) => !BRANCH_ORDER.includes(b)),
  ]

  const nodes = []
  const pos = {}
  let xCursor = 0
  let prevFamily = null

  for (const branch of branches) {
    const members = skills.filter((s) => s.branch === branch)
    if (!members.length) continue
    const family = members[0].family || FAMILY_OF_BRANCH[branch] || 'cal'
    if (prevFamily && prevFamily !== family) xCursor += FAMILY_GAP
    prevFamily = family

    const depth = branchDepth(members)
    const byDepth = new Map()
    for (const s of members) {
      const d = depth[s.id] || 0
      if (!byDepth.has(d)) byDepth.set(d, [])
      byDepth.get(d).push(s)
    }
    for (const group of byDepth.values()) {
      group.sort((a, b) => (b.star ? 1 : 0) - (a.star ? 1 : 0) || a.name.localeCompare(b.name))
    }

    const maxRow = Math.max(...[...byDepth.values()].map((g) => g.length), 1)
    const colW = Math.max(maxRow * (NODE + SIB_GAP), 220)

    for (const [d, group] of byDepth) {
      const rowW = group.length * (NODE + SIB_GAP) - SIB_GAP
      const startX = xCursor + (colW - rowW) / 2
      group.forEach((s, i) => {
        const x = startX + i * (NODE + SIB_GAP)
        const y = d * ROW_H
        pos[s.id] = { x, y }
        nodes.push({
          id: s.id,
          type: 'skill',
          position: { x, y },
          data: { skill: s, depth: d },
        })
      })
    }

    nodes.push({
      id: `label-${branch}`,
      type: 'branchLabel',
      position: { x: xCursor + colW / 2, y: -52 },
      data: { label: branch, family },
      selectable: false,
      draggable: false,
    })

    xCursor += colW + COL_GAP
  }

  const edges = []
  for (const s of skills) {
    if (!pos[s.id]) continue
    for (const r of s.req || []) {
      if (!byId[r] || !pos[r]) continue
      edges.push({
        id: `${r}->${s.id}`,
        source: r,
        target: s.id,
        type: 'arrow',
        data: { cross: byId[r].branch !== s.branch },
      })
    }
  }

  return { nodes, edges }
}
