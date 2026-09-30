// Renders the pixel-art wheel to the PWA / favicon PNGs in public/.
//   node tools/make-icons.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { wheelPixels, WHEEL, WHEEL_TONES, COLOR } from '../src/lib/pixel/art.js'
import { Raster, hex } from './png.mjs'

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const px = wheelPixels()
const tones = WHEEL_TONES.map((t) => t && hex(t))

function icon(size, scale) {
  const r = new Raster(size, size, hex(COLOR.bg))
  const off = Math.floor((size - WHEEL * scale) / 2)
  for (let y = 0; y < WHEEL; y++) for (let x = 0; x < WHEEL; x++) {
    const t = px[y * WHEEL + x]
    if (t) r.rect(off + x * scale, off + y * scale, scale, scale, tones[t])
  }
  return r.png()
}

const out = { 'icon-512.png': [512, 13], 'icon-192.png': [192, 5], 'apple-touch-icon.png': [180, 5], 'favicon-32.png': [32, 1] }
for (const [name, [size, scale]] of Object.entries(out)) {
  writeFileSync(join(PUBLIC, name), icon(size, scale))
  console.log('wrote', name)
}
