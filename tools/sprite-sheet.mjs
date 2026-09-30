// Dev aid: render every pose to a PNG contact sheet so pictograms can be
// reviewed without a browser.  node tools/sprite-sheet.mjs [out.png] [filter,filter]
import { writeFileSync } from 'node:fs'
import { renderPose, G } from '../src/lib/pixel/figure.js'
import { POSES } from '../src/lib/pixel/poses.js'
import { Raster, hex } from './png.mjs'

const out = process.argv[2] || 'sprite-sheet.png'
const filters = (process.argv[3] || '').split(',').filter(Boolean)
const names = Object.keys(POSES).filter((n) => !filters.length || filters.some((f) => n.toLowerCase().includes(f.toLowerCase())))

const TONE = [null, hex('#f2efe6'), hex('#9a95a8'), hex('#5a5470'), hex('#ff4fa3')]
const S = 5, PAD = 6, COLS = 10
const cell = G * S + PAD
const rows = Math.ceil(names.length / COLS)
const r = new Raster(COLS * cell + PAD, rows * cell + PAD, hex('#0f0d17'))
names.forEach((name, i) => {
  const ox = PAD + (i % COLS) * cell, oy = PAD + Math.floor(i / COLS) * cell
  r.rect(ox, oy, G * S, G * S, hex('#1a1626'))
  const px = renderPose(POSES[name])
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    const t = px[y * G + x]
    if (t) r.rect(ox + x * S, oy + y * S, S, S, TONE[t])
  }
})
writeFileSync(out, r.png())
console.log(names.length, 'poses →', out)
console.log(names.map((n, i) => `${i % COLS === 0 ? '\n' : ''}${n}`).join('  '))
