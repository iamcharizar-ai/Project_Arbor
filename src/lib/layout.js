// TRUE TRIANGULAR LATTICE (60°/120°), axial hex coordinates.
//  1. Points live on the axial lattice (q, r). The six unit directions are the
//     three lattice-line families — E/W (0°), NE/SW (60°/240°), NW/SE
//     (120°/300°) — so every edge the layout emits is one of exactly three
//     angles. axialToPixel shears each row right by r/2 columns, which is what
//     keeps those three angles pure (a triangular lattice IS a sheared grid).
//  2. Crossing prevention reduces to plain occupancy: on a triangulated
//     lattice two unit segments can only meet at a shared endpoint, never
//     mid-segment. A double-jump (2× a unit direction) reserves its exact
//     midpoint through-cell, so double edges are crossing-safe the same way.
//  3. Wide, not tall: chains serpentine sideways, branch blocks tetris-pack
//     into a landscape field — the whole realm fits without zooming out.
//  4. Branch titles go wherever there IS space next to the block.
//  5. Hybrid: a skill may pin an absolute { q, r } via its `pos` field; pinned
//     nodes are placed exactly there and auto-placed blocks pack around them.
//     No `pos` → auto-placed exactly as if the feature didn't exist.
// GX must equal GY for a true 60°/120° lattice. 88 (not 64) so that after the
// RIM=30 edge trim in Realm.jsx every one of the three angles keeps a uniform
// visible segment.
export const GX = 88 // px per lattice column
export const GY = 88 // px per lattice row

const SQRT3_2 = Math.sqrt(3) / 2
const K = (q, r) => q + ',' + r

// axial (q,r) → pixel. y grows downward here; Realm renders with -y so the
// tree climbs upward on screen (children at higher r sit above their parent).
export function axialToPixel(q, r) {
  return { x: GX * (q + r / 2), y: GY * SQRT3_2 * r }
}

// pixel → nearest lattice point, via cube-coordinate rounding. Needed by
// edit-mode drag-snap. Inverse of axialToPixel.
export function pixelToAxial(x, y) {
  const rf = y / (GY * SQRT3_2)
  const qf = x / GX - rf / 2
  const sf = -qf - rf
  let q = Math.round(qf), r = Math.round(rf), s = Math.round(sf)
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf)
  if (dq > dr && dq > ds) q = -r - s
  else if (dr > ds) r = -q - s
  return { q, r }
}

// unit directions, named for readability in place()
const E = [1, 0], NE = [0, 1], NW = [-1, 1], W = [-1, 0], SW = [0, -1], SE = [1, -1]
const HEXN = [E, NE, NW, W, SW, SE] // the 6 neighbours, for packing buffer

export function layoutRealm(allSkills, realmId) {
  const skills = allSkills.filter((s) => s.realm === realmId)
  const byId = Object.fromEntries(skills.map((s) => [s.id, s]))
  const branches = [...new Set(skills.map((s) => s.branch))]

  // ── pinned positions: absolute (q,r). First writer wins a contested cell;
  //    a colliding pin falls back to auto-placement (never crash bad data). ──
  const pinnedPos = {}        // id -> { q, r }
  const pinnedOcc = new Set() // "q,r" of accepted pins
  for (const s of skills) {
    if (!s.pos || !Number.isInteger(s.pos.q) || !Number.isInteger(s.pos.r)) continue
    const key = K(s.pos.q, s.pos.r)
    if (pinnedOcc.has(key)) {
      console.warn(`arbor layout: pinned collision at (${key}) — ${s.id} falls back to auto`)
      continue
    }
    pinnedOcc.add(key)
    pinnedPos[s.id] = { q: s.pos.q, r: s.pos.r }
  }

  // Edges the placement algorithm produced on a clean single lattice line
  // (unit or double). Everything else — secondary reqs, cross-branch links,
  // pinned-to-far-child, tier-3 desperation — renders dashed/hidden-unless-
  // selected, so the always-visible edges are exactly the lattice-aligned ones.
  const cleanEdges = new Set() // "parent->child"

  // ── per-branch: build tree over AUTO members, lay on a local lattice ──────
  const blocks = []
  for (const branch of branches) {
    const members = skills.filter((s) => s.branch === branch && !pinnedPos[s.id])
    if (!members.length) continue
    const memberIds = new Set(members.map((s) => s.id))
    const parentOf = {}
    const kids = {}
    for (const s of members) {
      // a req pointing at a pinned sibling isn't in memberIds → no local parent
      // → this member becomes an extra local root (branches already routinely
      // have several roots, so this reuses an existing path, not a new one).
      const p = (s.req || []).find((r) => memberIds.has(r))
      parentOf[s.id] = p || null
      if (p) (kids[p] = kids[p] || []).push(s.id)
    }
    const roots = members.filter((s) => !parentOf[s.id]).map((s) => s.id)

    const treeSize = {}
    const visiting = new Set()
    const sizeOf = (id) => {
      if (treeSize[id]) return treeSize[id]
      if (visiting.has(id)) return 1 // cycle guard — hand/edit-mode data can loop
      visiting.add(id)
      treeSize[id] = 1 + (kids[id] || []).reduce((a, c) => a + sizeOf(c), 0)
      visiting.delete(id)
      return treeSize[id]
    }
    roots.forEach(sizeOf)

    const cells = new Map()     // "q,r" -> id
    const edgeCells = new Set() // "q,r" through-cells swept by double-jump edges
    const pos = {}              // id -> { q, r }
    const taken = (q, r) => cells.has(K(q, r)) || edgeCells.has(K(q, r))

    // Place childId reached from (pq,pr): tier-1 unit step in dirOrder, then
    // tier-2 double step (through-cell must be free), then tier-3 ring scan.
    // Tiers 1-2 land on a clean lattice line → recorded in cleanEdges.
    const settle = (parentId, childId, pq, pr, dirOrder) => {
      for (const [dq, dr] of dirOrder) {
        const q = pq + dq, r = pr + dr
        if (!taken(q, r)) {
          cells.set(K(q, r), childId); pos[childId] = { q, r }
          cleanEdges.add(parentId + '->' + childId)
          return { q, r }
        }
      }
      for (const [dq, dr] of dirOrder) {
        const tq = pq + dq, tr = pr + dr        // midpoint through-cell
        const q = pq + 2 * dq, r = pr + 2 * dr
        if (!taken(tq, tr) && !taken(q, r)) {
          cells.set(K(q, r), childId); pos[childId] = { q, r }
          edgeCells.add(K(tq, tr))
          cleanEdges.add(parentId + '->' + childId)
          return { q, r }
        }
      }
      // desperate: expanding hex ring — always terminates, edge not clean
      for (let rad = 1; rad < 80; rad++) {
        for (let ddq = -rad; ddq <= rad; ddq++) {
          for (let ddr = -rad; ddr <= rad; ddr++) {
            if ((Math.abs(ddq) + Math.abs(ddr) + Math.abs(ddq + ddr)) / 2 !== rad) continue
            const q = pq + ddq, r = pr + ddr
            if (!taken(q, r)) {
              cells.set(K(q, r), childId); pos[childId] = { q, r }
              return { q, r }
            }
          }
        }
      }
      return null
    }

    // d>0 leads the up-right diagonal (NE), d<0 leads up-left (NW) — the
    // serpentine. Chains zigzag; hubs fan the ordered children around,
    // up-biased, each starting at a distinct direction.
    const place = (id, d) => {
      const children = (kids[id] || []).slice().sort((a, b) => sizeOf(b) - sizeOf(a))
      const at = pos[id]
      const n = children.length
      for (let i = 0; i < n; i++) {
        const c = children[i]
        let dirOrder
        if (n === 1) {
          dirOrder = d >= 0 ? [NE, NW, E, W, SE, SW] : [NW, NE, W, E, SW, SE]
        } else {
          const fan = d >= 0 ? [NE, NW, E, SE, W, SW] : [NW, NE, W, SW, E, SE]
          const start = Math.min(i, fan.length - 1)
          dirOrder = [...fan.slice(start), ...fan.slice(0, start)]
        }
        if (pos[c]) continue // already placed (a req cycle) — don't re-place or recurse
        const got = settle(id, c, at.q, at.r, dirOrder)
        if (!got) continue
        // flip serpentine by the horizontal drift of the step just taken
        const driftX = (got.q - at.q) + (got.r - at.r) / 2
        place(c, driftX > 0 ? -1 : driftX < 0 ? 1 : d)
      }
    }

    let rootQ = 0
    for (const rt of roots.sort((a, b) => sizeOf(b) - sizeOf(a))) {
      while (taken(rootQ, 0)) rootQ += 2
      cells.set(K(rootQ, 0), rt); pos[rt] = { q: rootQ, r: 0 }
      place(rt, 1)
      rootQ += 4 // gap between sibling root subtrees
    }

    // safety net: a req cycle (or a self-req typo) leaves members with no root,
    // so the loop above would never place them and they'd silently vanish from
    // the canvas. Seed any still-unplaced member as its own root — the pos[c]
    // guard in place() keeps the cycle from recursing forever.
    for (const m of members) {
      if (pos[m.id]) continue
      while (taken(rootQ, 0)) rootQ += 2
      cells.set(K(rootQ, 0), m.id); pos[m.id] = { q: rootQ, r: 0 }
      place(m.id, 1)
      rootQ += 4
    }

    // normalize to a 0-based footprint; include edgeCells so a neighbouring
    // block can't pack a node onto a cell one of our edges passes through
    let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity
    const footprint = []
    for (const id of Object.keys(pos)) footprint.push([pos[id].q, pos[id].r])
    for (const key of edgeCells) footprint.push(key.split(',').map(Number))
    for (const [q, r] of footprint) {
      minQ = Math.min(minQ, q); maxQ = Math.max(maxQ, q)
      minR = Math.min(minR, r); maxR = Math.max(maxR, r)
    }
    for (const id of Object.keys(pos)) { pos[id].q -= minQ; pos[id].r -= minR }
    const cellList = footprint.map(([q, r]) => [q - minQ, r - minR])
    blocks.push({
      branch, pos, cells: cellList,
      w: maxQ - minQ + 1, h: maxR - minR + 1, n: members.length,
    })
  }

  // ── tetris-pack blocks onto the shared lattice, seeded with pinned cells ──
  // 1-cell (self + 6 neighbours) buffer ⇒ no two blocks share or touch an
  // occupied cell ⇒ zero cross-block crossings. The field is deliberately WIDE.
  const totalCells = blocks.reduce((a, b) => a + b.n, 0)
  const fieldW = Math.max(...blocks.map((b) => b.w), Math.ceil(Math.sqrt(totalCells || 1) * 2.3))
  const global = new Set(pinnedOcc)
  const fits = (block, oq, or) => {
    for (const [cq, cr] of block.cells) {
      if (global.has(K(cq + oq, cr + or))) return false
      for (const [dq, dr] of HEXN) if (global.has(K(cq + oq + dq, cr + or + dr))) return false
    }
    return true
  }

  const placedBlocks = []
  for (const block of blocks.sort((a, b) => b.n - a.n)) {
    let oq = 0, or = 0, found = false
    for (or = 0; or < 600 && !found; or++) {
      for (oq = 0; oq <= Math.max(0, fieldW - block.w); oq++) {
        if (fits(block, oq, or)) { found = true; break }
      }
    }
    for (const id of Object.keys(block.pos)) { block.pos[id].q += oq; block.pos[id].r += or }
    for (const [cq, cr] of block.cells) global.add(K(cq + oq, cr + or))
    placedBlocks.push({ block, oq, or })
  }

  // ── branch titles: first clear 5×3 pocket next to the block wins ──────────
  const labelClear = (lq, lr) => {
    for (let dq = -1; dq <= 3; dq++)
      for (let dr = -1; dr <= 1; dr++)
        if (global.has(K(lq + dq, lr + dr))) return false
    return true
  }
  const placedLabels = []
  for (const { block, oq, or } of placedBlocks) {
    const midR = or + Math.round(block.h / 2)
    const spots = [
      [oq + block.w + 1, midR],
      [oq - 4, midR],
      [oq + block.w + 1, or],
      [oq - 4, or],
      [oq + Math.round(block.w / 2) - 1, or + block.h + 1],
      [oq + Math.round(block.w / 2) - 1, or - 2],
    ]
    const put = spots.find(([lq, lr]) => labelClear(lq, lr)) || spots[4]
    for (let dq = -1; dq <= 3; dq++) global.add(K(put[0] + dq, put[1]))
    placedLabels.push({ branch: block.branch, q: put[0], r: put[1] })
  }

  // ── emit React Flow nodes/edges (axial → px, y flipped so it grows up) ────
  const posAll = {}
  for (const { block } of placedBlocks) Object.assign(posAll, block.pos)
  Object.assign(posAll, pinnedPos)

  const nodes = skills.filter((s) => posAll[s.id]).map((s) => {
    const { q, r } = posAll[s.id]
    const p = axialToPixel(q, r)
    return {
      id: s.id,
      type: 'skill',
      position: { x: p.x, y: -p.y },
      data: { skill: s, depth: Math.min(Math.floor(r / 2), 8) },
    }
  })
  for (const l of placedLabels) {
    const p = axialToPixel(l.q, l.r)
    nodes.push({
      id: `label-${l.branch}`,
      type: 'branchLabel',
      position: { x: p.x, y: -p.y },
      data: { label: l.branch },
      selectable: false,
      draggable: false,
    })
  }

  const edges = []
  for (const s of skills) {
    if (!posAll[s.id]) continue
    for (let i = 0; i < (s.req || []).length; i++) {
      const r = s.req[i]
      if (!byId[r] || !posAll[r]) continue
      edges.push({
        id: `${r}->${s.id}`,
        source: r,
        target: s.id,
        type: 'arrow',
        data: { cross: !cleanEdges.has(`${r}->${s.id}`) },
      })
    }
  }

  let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity
  for (const id of Object.keys(posAll)) {
    minQ = Math.min(minQ, posAll[id].q); maxQ = Math.max(maxQ, posAll[id].q)
    minR = Math.min(minR, posAll[id].r); maxR = Math.max(maxR, posAll[id].r)
  }
  return { nodes, edges, occupied: global, bounds: { minQ, maxQ, minR, maxR } }
}
