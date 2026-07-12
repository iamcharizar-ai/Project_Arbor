// WINGS-faithful DIAMOND lattice. Studied from the wingssw.com reference:
//  1. Diamond cells, not squares: nodes live on the checkerboard (x+y even).
//     Unit steps are the two shallow diagonals (±1,+1) and the vertical
//     (0,+2). Odd lattice points don't exist — which makes two opposite
//     diagonals through the same cell geometrically impossible, so
//     diag/diag crossings are ruled out by parity alone.
//  2. Wide, not tall: chains serpentine sideways and branch blocks pack into
//     a field shaped for a landscape screen — the whole realm fits without
//     zooming out.
//  3. Blocks sit close (1-cell buffer): separate branches read as one big
//     organism, like the reference.
//  4. Branch titles go wherever there IS space next to the block — right,
//     left, above — never hardcoded below it.
export const GX = 88 // px per lattice column
export const GY = 52 // px per lattice row (vertical edge spans 2 rows)

const K = (x, y) => x + ',' + y
const even = (n) => ((n % 2) + 2) % 2 === 0

export function layoutRealm(allSkills, realmId) {
  const skills = allSkills.filter((s) => s.realm === realmId)
  const byId = Object.fromEntries(skills.map((s) => [s.id, s]))
  const branches = [...new Set(skills.map((s) => s.branch))]

  // ── per-branch: build tree, lay it on a local diamond lattice ────────────
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

    const treeSize = {}
    const sizeOf = (id) => {
      if (treeSize[id]) return treeSize[id]
      treeSize[id] = 1 + (kids[id] || []).reduce((a, c) => a + sizeOf(c), 0)
      return treeSize[id]
    }
    roots.forEach(sizeOf)

    const cells = new Map() // "x,y" -> id (even-parity points only)
    const mids = new Set()  // odd midpoints occupied by vertical/horizontal edges
    const edgeCells = new Set() // even points a long fallback edge sweeps through
    const pos = {}          // id -> { x, y }

    // midpoints/through-cells an edge (px,py)→(x,y) would occupy
    const edgeMarks = (px, py, x, y) => {
      const dx = x - px, dy = y - py
      const marks = { mids: [], through: [] }
      if (Math.abs(dx) === 1 && Math.abs(dy) === 1) return marks // unit diagonal: safe by parity
      const mx = px + dx / 2, my = py + dy / 2
      if (Number.isInteger(mx) && Number.isInteger(my)) {
        if (even(mx + my)) marks.through.push([mx, my]) // even → a real cell
        else marks.mids.push([mx, my])                  // odd → potential crossing point
      }
      return marks
    }
    const edgeOk = (px, py, x, y) => {
      const m = edgeMarks(px, py, x, y)
      for (const [ax, ay] of m.mids) if (mids.has(K(ax, ay))) return false
      for (const [ax, ay] of m.through) if (cells.has(K(ax, ay)) || edgeCells.has(K(ax, ay))) return false
      return true
    }
    const commitEdge = (px, py, x, y) => {
      const m = edgeMarks(px, py, x, y)
      for (const [ax, ay] of m.mids) mids.add(K(ax, ay))
      for (const [ax, ay] of m.through) edgeCells.add(K(ax, ay))
    }
    const free = (x, y) => !cells.has(K(x, y)) && !edgeCells.has(K(x, y))

    const settle = (id, px, py, candidates) => {
      for (const [x, y] of candidates) {
        if (even(x + y) && free(x, y) && edgeOk(px, py, x, y)) {
          cells.set(K(x, y), id)
          pos[id] = { x, y }
          commitEdge(px, py, x, y)
          return { x, y }
        }
      }
      // desperate: scan outward on the parity lattice — always terminates
      for (let r = 1; r < 60; r++) {
        for (let yy = py + 1; yy <= py + 1 + r; yy++) {
          for (let xx = px - r; xx <= px + r; xx++) {
            if (!even(xx + yy) || !free(xx, yy)) continue
            cells.set(K(xx, yy), id)
            pos[id] = { x: xx, y: yy }
            return { x: xx, y: yy }
          }
        }
      }
      return null
    }

    // dir alternates per diagonal step → the WINGS serpentine
    const place = (id, dir) => {
      const children = (kids[id] || []).slice().sort((a, b) => sizeOf(b) - sizeOf(a))
      const at = pos[id]
      for (let i = 0; i < children.length; i++) {
        const c = children[i]
        const d = dir || 1
        let candidates
        if (children.length === 1) {
          // chain: zigzag diagonally first, straight up second, then spill
          candidates = [
            [at.x + d, at.y + 1], [at.x - d, at.y + 1], [at.x, at.y + 2],
            [at.x + 2 * d, at.y + 2], [at.x - 2 * d, at.y + 2],
            [at.x + 2 * d, at.y], [at.x - 2 * d, at.y],   // sideways spill
            [at.x + d, at.y - 1], [at.x - d, at.y - 1],   // later skill, placed lower
          ]
        } else {
          // hub: biggest subtree climbs straight, others fan diagonally
          const lane = [
            [[at.x, at.y + 2], [at.x + d, at.y + 1], [at.x - d, at.y + 1]],
            [[at.x + d, at.y + 1], [at.x + 2 * d, at.y + 2], [at.x + 2 * d, at.y]],
            [[at.x - d, at.y + 1], [at.x - 2 * d, at.y + 2], [at.x - 2 * d, at.y]],
          ][Math.min(i, 2)]
          candidates = [...lane,
            [at.x + 2 * d, at.y + 2], [at.x - 2 * d, at.y + 2],
            [at.x + 2 * d, at.y], [at.x - 2 * d, at.y],
            [at.x + d, at.y - 1], [at.x - d, at.y - 1],
          ]
        }
        const got = settle(c, at.x, at.y, candidates)
        if (!got) continue
        const stepDx = got.x - at.x
        // flip serpentine direction after a diagonal, keep it after a vertical
        place(c, stepDx > 0 ? -1 : stepDx < 0 ? 1 : d)
      }
    }

    let rootX = 0
    for (const r of roots.sort((a, b) => sizeOf(b) - sizeOf(a))) {
      while (!free(rootX, 0)) rootX += 2
      cells.set(K(rootX, 0), r)
      pos[r] = { x: rootX, y: 0 }
      place(r, 1)
      rootX += 4
    }

    // normalize to a 0-based footprint (shift by even amounts → parity kept)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const id of Object.keys(pos)) {
      minX = Math.min(minX, pos[id].x); maxX = Math.max(maxX, pos[id].x)
      minY = Math.min(minY, pos[id].y); maxY = Math.max(maxY, pos[id].y)
    }
    if (!even(minX)) minX -= 1
    if (!even(minY)) minY -= 1
    const cellList = []
    for (const id of Object.keys(pos)) {
      pos[id].x -= minX
      pos[id].y -= minY
      cellList.push([pos[id].x, pos[id].y])
    }
    blocks.push({
      branch, pos, cells: cellList,
      w: maxX - minX + 1, h: maxY - minY + 1, n: members.length,
    })
  }

  // ── tetris-pack blocks onto the shared lattice, bottom-up left-right ─────
  // 1-cell buffer between blocks ⇒ no two blocks share an edge cell ⇒ zero
  // cross-block crossings, while silhouettes interlock like the reference.
  // The field is deliberately WIDE: spread out, not up.
  const totalCells = blocks.reduce((a, b) => a + b.n, 0)
  const fieldW = Math.max(...blocks.map((b) => b.w), Math.ceil(Math.sqrt(totalCells) * 2.3))
  const global = new Set()
  const fits = (block, ox, oy) => {
    for (const [cx, cy] of block.cells) {
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          if (global.has(K(cx + ox + dx, cy + oy + dy))) return false
    }
    return true
  }

  const placedBlocks = []
  for (const block of blocks.sort((a, b) => b.n - a.n)) {
    const parity = ((block.cells[0][0] + block.cells[0][1]) % 2 + 2) % 2
    let ox = 0, oy = 0
    outer: for (oy = 0; oy < 400; oy++) {
      for (ox = 0; ox <= Math.max(0, fieldW - block.w); ox++) {
        if (!even(ox + oy + parity)) continue // keep every node on the even lattice
        if (fits(block, ox, oy)) break outer
      }
    }
    for (const id of Object.keys(block.pos)) {
      block.pos[id].x += ox
      block.pos[id].y += oy
    }
    for (const [cx, cy] of block.cells) global.add(K(cx + ox, cy + oy))
    placedBlocks.push({ block, ox, oy })
  }

  // ── branch titles: wherever there IS space next to the block ────────────
  // Try right of the block at mid-height, then left, base corners, above,
  // below — the first spot with a clear 5×3 pocket wins, then gets reserved
  // so later titles can't collide with it.
  const labelClear = (lx, ly) => {
    for (let dx = -1; dx <= 3; dx++)
      for (let dy = -1; dy <= 1; dy++)
        if (global.has(K(lx + dx, ly + dy))) return false
    return true
  }
  const placedLabels = []
  for (const { block, ox, oy } of placedBlocks) {
    const midY = oy + Math.round(block.h / 2)
    const spots = [
      [ox + block.w + 1, midY],          // right, mid-height
      [ox - 4, midY],                    // left, mid-height
      [ox + block.w + 1, oy],            // right, base
      [ox - 4, oy],                      // left, base
      [ox + Math.round(block.w / 2) - 1, oy + block.h + 1], // above
      [ox + Math.round(block.w / 2) - 1, oy - 2],           // below
    ]
    const put = spots.find(([lx, ly]) => labelClear(lx, ly)) || spots[4]
    for (let dx = -1; dx <= 3; dx++) global.add(K(put[0] + dx, put[1]))
    placedLabels.push({ branch: block.branch, x: put[0], y: put[1] })
  }

  // ── emit React Flow nodes/edges (lattice → px, y grows upward) ───────────
  const posAll = {}
  for (const { block } of placedBlocks) Object.assign(posAll, block.pos)

  const nodes = skills.map((s) => ({
    id: s.id,
    type: 'skill',
    position: { x: posAll[s.id].x * GX, y: -posAll[s.id].y * GY },
    data: { skill: s, depth: Math.min(Math.floor(posAll[s.id].y / 2), 8) },
  }))
  for (const l of placedLabels) {
    nodes.push({
      id: `label-${l.branch}`,
      type: 'branchLabel',
      position: { x: l.x * GX, y: -l.y * GY },
      data: { label: l.branch },
      selectable: false,
      draggable: false,
    })
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
        type: 'arrow',
        data: { cross: i > 0 || byId[r].branch !== s.branch },
      })
    }
  }
  return { nodes, edges }
}
