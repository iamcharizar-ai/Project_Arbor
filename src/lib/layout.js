// Columnar progression layout — Wings-style.
// Each branch is a vertical column: roots at the top, harder skills below.
// Intra-branch depth uses only same-branch prerequisites so a column reads as
// one clear difficulty ladder. Cross-branch reqs still draw as edges.
//
// Within a column, rows are ordered by barycenter sweeps (Sugiyama-style) and
// each node is then pulled under the mean x of its parents, so edges run as
// close to vertical as the row allows and crossings are minimised.

export const NODE = 88
export const COL_GAP = 96
export const FAMILY_GAP = 64
export const ROW_H = 168
export const SIB_GAP = 28
const STEP = NODE + SIB_GAP

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

// Count edge crossings between two adjacent rows.
function crossings(upper, lower, parentsOf) {
  const upIdx = new Map(upper.map((s, i) => [s.id, i]))
  const pairs = []
  lower.forEach((s, li) => {
    for (const p of parentsOf(s)) if (upIdx.has(p)) pairs.push([upIdx.get(p), li])
  })
  let n = 0
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const [a1, b1] = pairs[i]
      const [a2, b2] = pairs[j]
      if ((a1 < a2 && b1 > b2) || (a1 > a2 && b1 < b2)) n++
    }
  }
  return n
}

function totalCrossings(rows, parentsOf) {
  let n = 0
  for (let d = 1; d < rows.length; d++) n += crossings(rows[d - 1], rows[d], parentsOf)
  return n
}

function baseSort(a, b) {
  return (b.star ? 1 : 0) - (a.star ? 1 : 0) || a.name.localeCompare(b.name)
}

// Order the rows of one column to minimise crossings. `rows[d]` is the list
// of skills at depth d. Parents live on shallower rows; children on deeper.
function orderRows(rows, ids) {
  const parentsOf = (s) => (s.req || []).filter((r) => ids.has(r))
  const childrenOf = new Map()
  for (const row of rows) {
    for (const s of row) {
      for (const p of parentsOf(s)) {
        if (!childrenOf.has(p)) childrenOf.set(p, [])
        childrenOf.get(p).push(s.id)
      }
    }
  }
  const pos = new Map()
  const stamp = () => rows.forEach((row) => row.forEach((s, i) => pos.set(s.id, i)))
  const bary = (neighbours, fallback) => {
    const xs = neighbours.filter((id) => pos.has(id)).map((id) => pos.get(id))
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : fallback
  }
  const sortRow = (row, keyOf) => {
    const keyed = row.map((s, i) => ({ s, k: keyOf(s, i) }))
    keyed.sort((a, b) => a.k - b.k || baseSort(a.s, b.s))
    return keyed.map((k) => k.s)
  }

  rows.forEach((row) => row.sort(baseSort))
  stamp()
  let best = rows.map((r) => r.slice())
  let bestN = totalCrossings(best, parentsOf)

  for (let sweep = 0; sweep < 6 && bestN > 0; sweep++) {
    // down: order each row by the mean position of its parents
    for (let d = 1; d < rows.length; d++) {
      rows[d] = sortRow(rows[d], (s, i) => bary(parentsOf(s), i))
      stamp()
    }
    // up: order each row by the mean position of its children
    for (let d = rows.length - 2; d >= 0; d--) {
      rows[d] = sortRow(rows[d], (s, i) => bary(childrenOf.get(s.id) || [], i))
      stamp()
    }
    const n = totalCrossings(rows, parentsOf)
    if (n < bestN) {
      bestN = n
      best = rows.map((r) => r.slice())
    }
  }
  return best
}

// Assign x (in STEP units) to every node of a column: each node wants to sit
// under the mean x of its parents; overlaps are resolved left-to-right while
// keeping the crossing-minimised order. Roots are spread evenly.
function placeRows(rows, ids) {
  const x = new Map()
  const parentsOf = (s) => (s.req || []).filter((r) => ids.has(r) && x.has(r))
  rows.forEach((row, d) => {
    if (d === 0) {
      row.forEach((s, i) => x.set(s.id, i))
      return
    }
    const want = row.map((s) => {
      const ps = parentsOf(s)
      return ps.length ? ps.reduce((a, p) => a + x.get(p), 0) / ps.length : null
    })
    // nodes with no placed parent tuck in beside their neighbours
    for (let i = 0; i < want.length; i++) {
      if (want[i] != null) continue
      const left = want.slice(0, i).reverse().find((v) => v != null)
      const right = want.slice(i + 1).find((v) => v != null)
      want[i] = left != null ? left + 1 : right != null ? right - 1 : i
    }
    // resolve overlaps by pushing right, then slide the run back so its mean
    // matches the wanted mean (keeps a wide row centred over its parents)
    const out = want.slice()
    for (let i = 1; i < out.length; i++) if (out[i] < out[i - 1] + 1) out[i] = out[i - 1] + 1
    const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length
    const shift = mean(want) - mean(out)
    row.forEach((s, i) => x.set(s.id, out[i] + shift))
  })
  return x
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

    const ids = new Set(members.map((s) => s.id))
    const depth = branchDepth(members)
    const maxD = Math.max(...members.map((s) => depth[s.id] || 0))
    let rows = Array.from({ length: maxD + 1 }, () => [])
    for (const s of members) rows[depth[s.id] || 0].push(s)

    rows = orderRows(rows, ids)
    const xUnit = placeRows(rows, ids)

    let minX = Infinity
    let maxX = -Infinity
    for (const v of xUnit.values()) {
      minX = Math.min(minX, v)
      maxX = Math.max(maxX, v)
    }
    const span = (maxX - minX) * STEP + NODE
    const colW = Math.max(span, 220)
    const pad = (colW - span) / 2

    rows.forEach((row, d) => {
      for (const s of row) {
        const x = Math.round(xCursor + pad + (xUnit.get(s.id) - minX) * STEP)
        const y = d * ROW_H
        pos[s.id] = { x, y }
        nodes.push({
          id: s.id,
          type: 'skill',
          position: { x, y },
          // explicit size so fitView can target nodes that have never been
          // rendered (onlyRenderVisibleElements skips measuring off-screen ones)
          width: NODE,
          height: NODE,
          data: { skill: s, depth: d },
        })
      }
    })

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
