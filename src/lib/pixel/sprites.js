// Runtime sprite cache: pixel data → small offscreen canvases (drawn 1:1 art
// pixel → SCALE device px, nearest-neighbour) that the tree canvas blits, plus
// data-URL versions of the UI glyphs and wheel for the DOM chrome.
import { renderPose, G } from './figure.js'
import { POSES } from './poses.js'
import { poseOf } from './skillPoses.js'
import { SKIN, GLYPHS, WHEEL, wheelPixels, WHEEL_TONES } from './art.js'

export const SCALE = 4          // device px per art pixel inside the caches
export const ART = 3            // world px per art pixel on the tree
export const FRAME = G + 4      // node frame, in art pixels
export const NODE = FRAME * ART // node size in tree-world units

const make = (w, h) => {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return c
}

const poseGrids = new Map()
const gridOf = (pose) => {
  let g = poseGrids.get(pose)
  if (!g) { g = renderPose(POSES[pose] || POSES.stand); poseGrids.set(pose, g) }
  return g
}

// One canvas per (pose, status, mip): frame + figure baked together so the tree
// blits a single sprite per node. Mips are drawn from the art data at k device
// px per art pixel (not by scaling a big bitmap), so each level is crisp.
const baked = new Map()
export function getNodeSprite(skillId, status, k) {
  const pose = poseOf(skillId)
  const key = pose + '|' + status + '|' + k
  let c = baked.get(key)
  if (c) return c
  const skin = SKIN[status]
  const F = FRAME
  c = make(F * k, F * k)
  const x = c.getContext('2d')
  const px = (col, x0, y0, w, h) => { x.fillStyle = col; x.fillRect(x0 * k, y0 * k, w * k, h * k) }
  px(skin.fill, 1, 1, F - 2, F - 2)
  px(skin.bevel, 1, F - 3, F - 2, 2)
  px(skin.frame, 1, 0, F - 2, 1); px(skin.frame, 1, F - 1, F - 2, 1)
  px(skin.frame, 0, 1, 1, F - 2); px(skin.frame, F - 1, 1, 1, F - 2)
  if (status === 'mastered' || status === 'inprogress') {
    x.globalAlpha = 0.35
    px(skin.frame, 2, 1, F - 4, 1); px(skin.frame, 2, F - 2, F - 4, 1)
    px(skin.frame, 1, 2, 1, F - 4); px(skin.frame, F - 2, 2, 1, F - 4)
    x.globalAlpha = 1
  }
  const grid = gridOf(pose)
  const off = (F - G) / 2
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const t = grid[j * G + i]
    if (t) px(skin.tones[t], off + i, off + j, 1, 1)
  }
  baked.set(key, c)
  return c
}

const figures = new Map()
export function getFigure(skillId, status) {
  const pose = poseOf(skillId)
  const key = pose + '|' + status
  let c = figures.get(key)
  if (c) return c
  const tones = SKIN[status].tones
  const px = gridOf(pose)
  c = make(G * SCALE, G * SCALE)
  const x = c.getContext('2d')
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const t = px[j * G + i]
    if (t) { x.fillStyle = tones[t]; x.fillRect(i * SCALE, j * SCALE, SCALE, SCALE) }
  }
  figures.set(key, c)
  return c
}

const badges = new Map()
export function getBadge(name, ink, edge) {
  const key = name + ink + edge
  let c = badges.get(key)
  if (c) return c
  const rows = GLYPHS[name]
  const w = rows[0].length, h = rows.length
  c = make((w + 2) * SCALE, (h + 2) * SCALE)
  const x = c.getContext('2d')
  const mark = (col, ox, oy) => {
    x.fillStyle = col
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (rows[j][i] === '#') x.fillRect((i + 1 + ox) * SCALE, (j + 1 + oy) * SCALE, SCALE, SCALE)
    }
  }
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) mark(edge, ox, oy)
  mark(ink, 0, 0)
  badges.set(key, c)
  return c
}

// ── DOM chrome: glyphs as CSS-mask data URLs (tinted by currentColor) ─────
const urls = new Map()
export function glyphURL(name) {
  let u = urls.get(name)
  if (u) return u
  const rows = GLYPHS[name]
  const w = rows[0].length, h = rows.length, k = 4
  const c = make(w * k, h * k)
  const x = c.getContext('2d')
  x.fillStyle = '#000'
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (rows[j][i] === '#') x.fillRect(i * k, j * k, k, k)
  u = { url: c.toDataURL(), w, h }
  urls.set(name, u)
  return u
}

export function wheelCanvas(scale = 4) {
  const px = wheelPixels()
  const c = make(WHEEL * scale, WHEEL * scale)
  const x = c.getContext('2d')
  for (let j = 0; j < WHEEL; j++) for (let i = 0; i < WHEEL; i++) {
    const t = px[j * WHEEL + i]
    if (t) { x.fillStyle = WHEEL_TONES[t]; x.fillRect(i * scale, j * scale, scale, scale) }
  }
  return c
}
let wheelURLCache = null
export const wheelURL = () => (wheelURLCache ??= wheelCanvas(4).toDataURL())

// Figure as an <img>-able data URL (list rows, the detail panel). Drawn 4 device
// px per art pixel, so 24/48 CSS px displays are exact integer ratios.
const figureUrls = new Map()
export function figureURL(skillId, status) {
  const key = poseOf(skillId) + '|' + status
  let u = figureUrls.get(key)
  if (!u) { u = getFigure(skillId, status).toDataURL(); figureUrls.set(key, u) }
  return u
}
