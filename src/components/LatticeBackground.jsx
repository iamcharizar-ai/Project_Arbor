import React from 'react'
import { useStore } from '@xyflow/react'
import { GX } from '../lib/layout.js'

// The triangular grid as ONE repeating tile (a GX × 2·S cell holding both
// triangles), so the background is a single full-viewport pattern fill instead
// of three stacked ones — a third of the per-frame paint cost while panning.
// The tile carries all three line families: two horizontals plus the up-right
// and up-left zig-zags whose vertices are the lattice points.
//
// It rides the React Flow viewport transform ([x,y,zoom]) via patternTransform,
// so pan/zoom stay in lockstep with the nodes. NODE_HALF shifts the grid so the
// lines run through node CENTRES (React Flow positions a node by its top-left,
// and a skill node is 60px). Must track .sk's width in styles.css.
const S = (GX * Math.sqrt(3)) / 2
const NODE_HALF = 30

// one path, multiple subpaths: 2 horizontals + the two diagonal zig-zags
const TILE = [
  `M0 0 H${GX}`,
  `M0 ${S} H${GX}`,
  `M0 0 L${GX / 2} ${S} L${GX} ${2 * S}`,
  `M${GX} 0 L${GX / 2} ${S} L0 ${2 * S}`,
].join(' ')

// mirror Realm.jsx's zoom LOD so the background thins out / drops with the rest
function lodOf(zoom) {
  return zoom < 0.32 ? 2 : zoom < 0.55 ? 1 : 0
}

export default function LatticeBackground() {
  const [tx, ty, zoom] = useStore((s) => s.transform)
  const lod = lodOf(zoom)
  const transform = `translate(${tx + NODE_HALF * zoom} ${ty + NODE_HALF * zoom}) scale(${zoom})`
  return (
    <svg className={`lattice-bg lod-${lod}`} aria-hidden="true">
      <defs>
        <pattern
          id="lattice-grid"
          patternUnits="userSpaceOnUse"
          width={GX}
          height={2 * S}
          patternTransform={transform}
        >
          <path className="lattice-line" d={TILE} />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill="url(#lattice-grid)" />
    </svg>
  )
}
