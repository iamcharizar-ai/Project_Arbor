// WINGS-faithful lattice layout. Studied from wingssw.com's calisthenics map:
//  1. ONE global square lattice — every node of every branch snaps to it, and
//     branch blocks interlock (tetris-packed) instead of living in bands.
//  2. Unit-step edges: a child sits exactly one row up, straight or one
//     column diagonal. Chains serpentine (zigzag) instead of stacking.
//  3. Zero edge crossings by construction: two unit diagonals can only cross
//     inside one shared cell, so each cell registers which diagonal it holds
//     and the opposite one is forbidden. Blocks keep a 1-cell buffer from
//     each other, which makes cross-block crossings geometrically impossible.
//  4. Depth ≠ row: progression climbs when it can, but a later skill may sit
//     sideways or even lower when the lattice is contested — the edge still
//     tells the true path (WINGS does exactly this).
const GAP = 150 // square pitch — diagonals at 45° like the reference

const K = (x, y) => x + ',' + y

export function layoutRealm(allSkills, realmId) {
  const skills = allSkills.filter((s) => s.realm === realmId)
  const byId = Object.fromEntries(skills.map((s) => [s.id, s]))
  const branches = [...new Set(skills.map((s) => s.branch))]

  // ── per-branch: build tree, lay it on a local lattice ────────────────────
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

    const cells = new Map() // "x,y" -> id
    const diag = new Set()  // "cx,cy,R|L" — which diagonal a cell already holds
    const vert = new Set()  // "x,y" — unit vertical span from (x,y) to (x,y+1)
    const half = new Set()  // "x,y" — a 2x1 edge's midpoint column crossing that span
    const pos = {}          // id -> { x, y }

    // a 2x1 shallow edge sweeps two cells and a midpoint column; precompute
    const shallow = (px, py, x, y) => {
      const sx = Math.sign(x - px)
      const cy = Math.min(py, y)
      return {
        mx: px + sx, cy,
        cellsX: sx > 0 ? [px, px + 1] : [px - 2, px - 1],
        o: sx > 0 ? 'L' : 'R', // the diagonal orientation it would cross
      }
    }

    const edgeOk = (px, py, x, y) => {
      const dx = x - px, dy = y - py
      if (dx === 0 && Math.abs(dy) === 1) return !half.has(`${x},${Math.min(py, y)}`)
      if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
        const cx = Math.min(px, x), cy = Math.min(py, y)
        const opp = dx === dy ? 'L' : 'R'
        return !diag.has(`${cx},${cy},${opp}`)
      }
      if (Math.abs(dx) === 2 && Math.abs(dy) === 1) {
        const s = shallow(px, py, x, y)
        if (vert.has(`${s.mx},${s.cy}`) || half.has(`${s.mx},${s.cy}`)) return false
        return !s.cellsX.some((cx) => diag.has(`${cx},${s.cy},${s.o}`))
      }
      return true // anything longer only comes from the desperate scan
    }
    const commitEdge = (px, py, x, y) => {
      const dx = x - px, dy = y - py
      if (dx === 0 && Math.abs(dy) === 1) vert.add(`${x},${Math.min(py, y)}`)
      else if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
        const cx = Math.min(px, x), cy = Math.min(py, y)
        diag.add(`${cx},${cy},${dx === dy ? 'R' : 'L'}`)
      } else if (Math.abs(dx) === 2 && Math.abs(dy) === 1) {
        const s = shallow(px, py, x, y)
        half.add(`${s.mx},${s.cy}`)
        // reserve the diagonals it sweeps so no future unit edge crosses it
        for (const cx of s.cellsX) diag.add(`${cx},${s.cy},${s.o}`)
      }
    }

    const settle = (id, px, py, candidates) => {
      for (const [x, y] of candidates) {
        if (!cells.has(K(x, y)) && edgeOk(px, py, x, y)) {
          cells.set(K(x, y), id)
          pos[id] = { x, y }
          commitEdge(px, py, x, y)
          return { x, y }
        }
      }
      // desperate: scan outward, upward first — always terminates
      for (let r = 1; r < 40; r++) {
        for (let yy = py + 1; yy <= py + 1 + r; yy++) {
          for (let xx = px - r; xx <= px + r; xx++) {
            if (!cells.has(K(xx, yy))) {
              cells.set(K(xx, yy), id)
              pos[id] = { x: xx, y: yy }
              return { x: xx, y: yy }
            }
          }
        }
      }
      return null
    }

    // dir alternates per diagonal step → the WINGS serpentine
    const place = (id, px, py, dir) => {
      const children = (kids[id] || []).slice().sort((a, b) => sizeOf(b) - sizeOf(a))
      const at = pos[id]
      for (let i = 0; i < children.length; i++) {
        const c = children[i]
        const d = dir || 1
        let candidates
        if (children.length === 1) {
          // chain: zigzag first, straight up second, then bend/spill
          candidates = [
            [at.x + d, at.y + 1], [at.x - d, at.y + 1], [at.x, at.y + 1],
            [at.x + 2 * d, at.y + 1], [at.x - 2 * d, at.y + 1],
            [at.x + d, at.y], [at.x - d, at.y],       // sideways
            [at.x + d, at.y - 1], [at.x - d, at.y - 1], // later skill, placed lower
          ]
        } else {
          // hub: biggest subtree climbs straight, others fan diagonally
          const lane = [
            [[at.x, at.y + 1], [at.x + d, at.y + 1], [at.x - d, at.y + 1]],
            [[at.x + d, at.y + 1], [at.x + 2 * d, at.y + 1], [at.x + d, at.y]],
            [[at.x - d, at.y + 1], [at.x - 2 * d, at.y + 1], [at.x - d, at.y]],
          ][Math.min(i, 2)]
          candidates = [...lane,
            [at.x + 2 * d, at.y + 1], [at.x - 2 * d, at.y + 1],
            [at.x + d, at.y], [at.x - d, at.y],
            [at.x + d, at.y - 1], [at.x - d, at.y - 1],
          ]
        }
        const got = settle(c, at.x, at.y, candidates)
        if (!got) continue
        const stepDx = got.x - at.x
        // flip serpentine direction after a diagonal, keep it after a vertical
        place(c, at.x, at.y, stepDx > 0 ? -1 : stepDx < 0 ? 1 : d)
      }
    }

    let rootX = 0
    for (const r of roots.sort((a, b) => sizeOf(b) - sizeOf(a))) {
      while (cells.has(K(rootX, 0))) rootX += 2
      cells.set(K(rootX, 0), r)
      pos[r] = { x: rootX, y: 0 }
      place(r, rootX, 0, 1)
      rootX += 2
    }

    // normalize to a 0-based footprint
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const id of Object.keys(pos)) {
      minX = Math.min(minX, pos[id].x); maxX = Math.max(maxX, pos[id].x)
      minY = Math.min(minY, pos[id].y); maxY = Math.max(maxY, pos[id].y)
    }
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
  // 1-cell buffer between blocks: no foreign node within Chebyshev 1 of any
  // of ours ⇒ no two blocks can share an edge cell ⇒ zero cross-block
  // crossings, while silhouettes still interlock like the reference.
  const totalCells = blocks.reduce((a, b) => a + b.n, 0)
  const fieldW = Math.max(...blocks.map((b) => b.w), Math.ceil(Math.sqrt(totalCells * 3.4)))
  const global = new Set()
  const fits = (block, ox, oy) => {
    for (const [cx, cy] of block.cells) {
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          if (global.has(K(cx + ox + dx, cy + oy + dy))) return false
    }
    return true
  }

  const placedLabels = []
  for (const block of blocks.sort((a, b) => b.n - a.n)) {
    let ox = 0, oy = 0
    outer: for (oy = 0; oy < 400; oy++) {
      for (ox = 0; ox <= Math.max(0, fieldW - block.w); ox++) {
        if (fits(block, ox, oy)) break outer
      }
    }
    for (const id of Object.keys(block.pos)) {
      block.pos[id].x += ox
      block.pos[id].y += oy
    }
    for (const [cx, cy] of block.cells) global.add(K(cx + ox, cy + oy))
    // label floats above the block; reserve its row so nothing packs into it
    const lx = ox + (block.w - 1) / 2
    const ly = oy + block.h
    for (let dx = -1; dx <= 1; dx++) global.add(K(Math.round(lx) + dx, ly))
    placedLabels.push({ branch: block.branch, x: lx, y: ly - 0.25 })
  }

  // ── emit React Flow nodes/edges (lattice → px, y grows upward) ───────────
  const posAll = {}
  for (const block of blocks) Object.assign(posAll, block.pos)

  const nodes = skills.map((s) => ({
    id: s.id,
    type: 'skill',
    position: { x: posAll[s.id].x * GAP, y: -posAll[s.id].y * GAP },
    data: { skill: s, depth: Math.min(posAll[s.id].y, 8) },
  }))
  for (const l of placedLabels) {
    nodes.push({
      id: `label-${l.branch}`,
      type: 'branchLabel',
      position: { x: l.x * GAP, y: -l.y * GAP },
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
        type: 'straight',
        data: { cross: i > 0 || byId[r].branch !== s.branch },
      })
    }
  }
  return { nodes, edges }
}
