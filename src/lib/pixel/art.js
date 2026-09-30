// Pure pixel data (no DOM): palette, UI glyph bitmaps, and the wheel. Shared by
// the in-app sprite cache and tools/make-icons.mjs.

export const STATUSES = ['locked', 'unlocked', 'inprogress', 'mastered']

// Keep in sync with :root in styles.css.
export const COLOR = {
  bg: '#0f0d17',
  panel: '#171425',
  line: '#3a3457',
  text: '#f2efe6',
  dim: '#8d87a6',
  gold: '#f2c14e',
  goldDeep: '#b8862b',
  goldLite: '#ffe28a',
}

// [frame, fill, ink (near limbs), far limbs, prop, motion mark]
export const SKIN = {
  locked:     { frame: '#5a5476', fill: '#151322', bevel: '#0d0b16', tones: [null, '#8a85a6', '#5f5a7a', '#443f5e', '#5f5a7a'] },
  unlocked:   { frame: '#f2efe6', fill: '#221e36', bevel: '#191629', tones: [null, '#f2efe6', '#a8a2bd', '#5f5980', '#f2c14e'] },
  inprogress: { frame: '#ff4fa3', fill: '#2c1230', bevel: '#1e0c22', tones: [null, '#ff9fd0', '#c23c86', '#7a2f66', '#ffe0f0'] },
  mastered:   { frame: '#a6e35a', fill: '#1a2412', bevel: '#111a0c', tones: [null, '#d3f79a', '#7fb63f', '#4b6a2a', '#f2efe6'] },
}

// ── UI glyphs (# = ink) ────────────────────────────────────────────────────
const g = (s) => s.trim().split('\n').map((r) => r.trim())
export const GLYPHS = {
  close: g(`
    #.....#
    .#...#.
    ..#.#..
    ...#...
    ..#.#..
    .#...#.
    #.....#`),
  check: g(`
    .......
    ......#
    .....##
    #...##.
    ##.##..
    .###...
    ..#....`),
  plus: g(`
    ...#...
    ...#...
    ...#...
    #######
    ...#...
    ...#...
    ...#...`),
  minus: g(`
    .......
    .......
    .......
    #######
    .......
    .......
    .......`),
  star: g(`
    ...#...
    ..###..
    #######
    .#####.
    ..###..
    .##.##.
    .#...#.`),
  gear: g(`
    ...#...
    .#####.
    .##.##.
    ##...##
    .##.##.
    .#####.
    ...#...`),
  bolt: g(`
    .....##
    ....##.
    ...##..
    ..#####
    ...##..
    ..##...
    .##....`),
  flame: g(`
    ...#...
    ..##...
    ..###..
    .#####.
    .##.###
    .##.###
    ..###..`),
  pencil: g(`
    ......##
    .....###
    ....###.
    ...###..
    ..###...
    .###....
    ###.....
    ##......`),
  search: g(`
    .#####...
    #.....#..
    #.....#..
    #.....#..
    #.....#..
    #.....#..
    .#####.#.
    .......##
    ........#`),
  fit: g(`
    ###...###
    #.......#
    #.......#
    .........
    .........
    .........
    #.......#
    #.......#
    ###...###`),
  arrow: g(`
    .......
    ....#..
    .....#.
    #######
    .....#.
    ....#..
    .......`),
  lock: g(`
    ..###..
    .#...#.
    .#...#.
    #######
    ###.###
    ###.###
    #######`),
}

// ── the wheel (ship's wheel with eight knobbed spokes) ─────────────────────
export const WHEEL = 31
// tones: 0 empty · 1 gold · 2 deep gold · 3 highlight
export function wheelPixels() {
  const N = WHEEL, c = (N - 1) / 2
  const px = new Uint8Array(N * N)
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < N && y < N) px[y * N + x] = t }
  // rim: a 2px ring at radius ~9.5
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - c, y - c)
    if (d >= 8.6 && d <= 10.4) set(x, y, d > 9.6 ? 2 : 1)
  }
  // eight spokes with knobs
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4
    const dx = Math.cos(a), dy = Math.sin(a)
    for (let r = 3; r <= 12.5; r += 0.5) set(Math.round(c + dx * r), Math.round(c + dy * r), 1)
    const kx = Math.round(c + dx * 13.6), ky = Math.round(c + dy * 13.6)
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      if (Math.abs(i) + Math.abs(j) < 3 || (i === 0 && j === 0)) set(kx + i, ky + j, 1)
    }
    set(kx - 1, ky - 1, 3)
  }
  // hub
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
    if (Math.abs(x) + Math.abs(y) <= 3) set(c + x, c + y, Math.abs(x) + Math.abs(y) >= 3 ? 2 : 1)
  }
  set(c - 1, c - 1, 3)
  return px
}
export const WHEEL_TONES = [null, COLOR.gold, COLOR.goldDeep, COLOR.goldLite]
