// Tidy-tree layout per realm, snapped to a WINGS-style grid: fixed column /
// row pitch, straight edges, roots at the bottom, progressions grow upward.
const X_GAP = 170
const Y_GAP = 190
const BRANCH_GAP = 170
const MAX_ROW_PX = 3400

export function layoutRealm(allSkills, realmId) {
  const skills = allSkills.filter((s) => s.realm === realmId)
  const byId = Object.fromEntries(skills.map((s) => [s.id, s]))
  const branches = [...new Set(skills.map((s) => s.branch))]

  const pos = {}
  const labels = []
  const blocks = []

  for (const branch of branches) {
    const members = skills.filter((s) => s.branch === branch)
    const memberIds = new Set(members.map((s) => s.id))
    const parentOf = {}
    const kids = {}
    for (const s of members) {
      const p = (s.req || []).find((r) => memberIds.has(r))
      parentOf[s.id] = p || null
      if (p) (kids[p] = kids[p] || []).push(s.id)
    }
    const roots = members.filter((s) => !parentOf[s.id]).map((s) => s.id)

    let cursor = 0
    const place = (id, depth) => {
      const children = kids[id] || []
      let x
      if (children.length === 0) { x = cursor; cursor += 1 }
      else {
        const xs = children.map((c) => place(c, depth + 1))
        // snap parent to the half-column grid so edges form clean verticals/diagonals
        x = Math.round(((Math.min(...xs) + Math.max(...xs)) / 2) * 2) / 2
      }
      pos[id] = { x, depth }
      return x
    }
    roots.forEach((r) => place(r, 0))

    const width = Math.max(cursor, 1)
    const maxDepth = Math.max(...members.map((s) => pos[s.id].depth), 0)
    blocks.push({ branch, members, width, maxDepth })
  }

  // flow-wrap branch blocks into rows so a realm stays screen-shaped
  let rowBaseY = 0
  let row = []
  let rowWidthPx = 0
  const flushRow = () => {
    if (!row.length) return
    const rowH = Math.max(...row.map((b) => b.maxDepth)) * Y_GAP
    let x0 = 0
    for (const b of row) {
      for (const s of b.members) {
        const p = pos[s.id]
        p.px = x0 + p.x * X_GAP
        p.py = rowBaseY - p.depth * Y_GAP
      }
      labels.push({ id: `label-${b.branch}`, branch: b.branch, x: x0 + ((b.width - 1) * X_GAP) / 2, y: rowBaseY + Y_GAP * 0.75 })
      x0 += b.width * X_GAP + BRANCH_GAP
    }
    rowBaseY += rowH + Y_GAP * 2.4
    row = []
    rowWidthPx = 0
  }
  for (const b of blocks) {
    const bPx = b.width * X_GAP + BRANCH_GAP
    if (row.length && rowWidthPx + bPx > MAX_ROW_PX) flushRow()
    row.push(b)
    rowWidthPx += bPx
  }
  flushRow()

  const nodes = skills.map((s) => ({
    id: s.id,
    type: 'skill',
    position: { x: pos[s.id].px, y: pos[s.id].py },
    data: { skill: s, depth: pos[s.id].depth },
  }))
  for (const l of labels) {
    nodes.push({ id: l.id, type: 'branchLabel', position: { x: l.x, y: l.y }, data: { label: l.branch }, selectable: false, draggable: false })
  }

  const edges = []
  for (const s of skills) {
    for (let i = 0; i < (s.req || []).length; i++) {
      const r = s.req[i]
      if (!byId[r]) continue
      edges.push({
        id: `${r}->${s.id}`,
        source: r,
        target: s.id,
        type: 'straight',
        data: { cross: i > 0 || byId[r].branch !== s.branch },
      })
    }
  }
  return { nodes, edges }
}
