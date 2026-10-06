// Canvas renderer for the skill tree.
//
// Why not DOM/SVG nodes: ~300 skills, ~320 edges, and every zoom step used to
// re-composite hundreds of elements. Here the whole tree is one <canvas>:
//   • the render loop only runs while something moves (camera, burst, hover…)
//   • sprites are pre-rendered once and blitted; off-screen nodes/edges are culled
//   • all geometry is snapped to device pixels, so the art stays crisp
//   • zoom is a smoothed target, so wheel bursts collapse into one draw per frame

import { NODE, ART, getNodeSprite, getBadge } from './pixel/sprites.js'
import { ROW_H } from './layout.js'
import { SKIN, COLOR } from './pixel/art.js'

const FONT_UI = '"Pixelify Sans", ui-monospace, monospace'
const FONT_TITLE = '"Silkscreen", "Pixelify Sans", monospace'
const EDGE = ['#3a3457', '#cfc9dc', '#ff4fa3', '#a6e35a']
const FAMILY_INK = { cal: '#f2efe6', mob: '#7fe0cf', mov: '#ffb070' }
const LABEL_W = 116
const LABEL_PX = 13
const MAX_Z = 2.4
const READABLE_Z = 0.75 // zoom at which node names are legible
const FLOOR_Z = 0.45   // never open a branch jump smaller than this
const BURST_MS = 650
const STATUS_KEY = ['locked', 'unlocked', 'inprogress', 'mastered']
const ROW_GAP = ROW_H - NODE // empty space between two rows of nodes

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lerp = (a, b, t) => a + (b - a) * t
const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export class TreeRenderer {
  constructor(canvas, layout, { onSelect } = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: true })
    this.layout = layout
    this.onSelect = onSelect || (() => {})
    this.nodes = layout.nodes
    this.n = this.nodes.length

    // view state
    this.W = 0; this.H = 0; this.dpr = 1
    this.z = 0.5; this.tx = 0; this.ty = 0
    this.minZ = 0.05
    this.zTarget = null      // smoothed wheel zoom: { z, sx, sy, wx, wy }
    this.flight = null       // animated camera move
    this.vx = 0; this.vy = 0 // pan inertia (css px / ms)

    // data state (set from React)
    this.status = new Uint8Array(this.n)
    this.adapt = new Uint8Array(this.n)
    this.dim = null
    this.sel = -1
    this.hov = -1
    this.bursts = []
    this.lines = null

    this.raf = 0
    this.last = 0
    this.pointers = new Map()
    this.drag = null
    this.pinch = null

    this._bind()
    this.prepareLabels()
    // canvas text never triggers a redraw when a webfont lands, so ask for the exact
    // faces we draw with and repaint once they're in
    Promise.all([`600 ${LABEL_PX}px ${FONT_UI}`, `700 16px ${FONT_TITLE}`].map((f) => document.fonts?.load(f)))
      .then(() => { if (this.destroyed) return; this.prepareLabels(); this.request() }, () => {})
    this.resize()
    this.prewarm()
  }

  // ── public API ───────────────────────────────────────────────────────────
  setStatus(status, adapt) { this.status = status; this.adapt = adapt; this.request() }
  setDim(dim) { this.dim = dim; this.request() }
  setSelected(i) { this.sel = i; this.request() }

  burst(i, statusIdx) {
    if (reduceMotion()) return
    this.bursts.push({ i, st: statusIdx, t0: performance.now() })
    this.request()
  }

  fitAll(animate = true) { this.fitRect(this.layout.bounds, { animate, pad: 0.04 }) }

  fitBranches(names, animate = true) {
    let r = null
    for (const nm of names) {
      const b = this.layout.branchBox.get(nm)
      if (!b) continue
      r = r ? { x0: Math.min(r.x0, b.x0), y0: Math.min(r.y0, b.y0), x1: Math.max(r.x1, b.x1), y1: Math.max(r.y1, b.y1) } : { ...b }
    }
    if (!r) return
    if (!this.W) { this.fitRect(r, { animate: false, pad: 0.08, maxZ: 0.95 }); return }
    // Branches are tall ladders: fit them by width and open at their roots at a
    // zoom where names are readable, instead of shrinking the whole column to a dot.
    const pad = 0.06
    const zWidth = this.W / ((r.x1 - r.x0) * (1 + pad * 2))
    const z = clamp(Math.max(this.fitZoom(r, pad), Math.min(zWidth, READABLE_Z), FLOOR_Z), this.minZ, 0.95)
    const cy = (r.y1 - r.y0) * z > this.H ? r.y0 - 30 / z + this.H / (2 * z) : (r.y0 + r.y1) / 2
    this.flyTo((r.x0 + r.x1) / 2, cy, z, animate)
  }

  focusNode(i, animate = true) {
    const n = this.nodes[i]
    if (!n) return
    this.flyTo(n.x + NODE / 2, n.y + NODE / 2, Math.max(this.z, 1.05), animate)
  }

  zoomBy(f) {
    this.flight = null
    const sx = this.W / 2, sy = this.H / 2
    this._zoomAt(f, sx, sy)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    this.raf = 0
    if (this._idle != null) (window.requestIdleCallback && window.cancelIdleCallback ? window.cancelIdleCallback : clearTimeout)(this._idle)
    this.ro?.disconnect()
    for (const [t, fn] of this._listeners) t.removeEventListener(...fn)
  }

  // ── camera ───────────────────────────────────────────────────────────────
  fitZoom(r, pad = 0.05) {
    const w = (r.x1 - r.x0) * (1 + pad * 2), h = (r.y1 - r.y0) * (1 + pad * 2)
    return Math.min(this.W / w, this.H / h)
  }

  fitRect(r, { animate = true, pad = 0.05, maxZ = MAX_Z } = {}) {
    if (!this.W) { this._pendingFit = { r, animate: false, pad, maxZ }; return }
    const z = clamp(this.fitZoom(r, pad), this.minZ, maxZ)
    this.flyTo((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, z, animate)
  }

  flyTo(cx, cy, z, animate = true) {
    z = clamp(z, this.minZ, MAX_Z)
    this.zTarget = null; this.vx = this.vy = 0
    if (!animate || reduceMotion() || !this.W) {
      this.flight = null
      this._setCenter(cx, cy, z)
      this.request()
      return
    }
    const cur = this._center()
    const dist = Math.hypot((cx - cur.x) * this.z, (cy - cur.y) * this.z)
    const dur = clamp(260 + dist * 0.25 + Math.abs(Math.log(z / this.z)) * 220, 300, 900)
    this.flight = { from: { ...cur, lz: Math.log(this.z) }, to: { x: cx, y: cy, lz: Math.log(z) }, t0: performance.now(), dur }
    this.request()
  }

  _center() { return { x: (this.W / 2 - this.tx) / this.z, y: (this.H / 2 - this.ty) / this.z } }

  _setCenter(cx, cy, z) {
    this.z = z
    this.tx = this.W / 2 - cx * z
    this.ty = this.H / 2 - cy * z
    this._clamp()
  }

  // keep the tree from being flung entirely out of view
  _clamp() {
    const b = this.layout.bounds
    const c = this._center()
    const mx = (this.W * 0.35) / this.z, my = (this.H * 0.35) / this.z
    const cx = clamp(c.x, b.x0 - mx, b.x1 + mx), cy = clamp(c.y, b.y0 - my, b.y1 + my)
    if (cx !== c.x) this.tx = this.W / 2 - cx * this.z
    if (cy !== c.y) this.ty = this.H / 2 - cy * this.z
  }

  _zoomAt(f, sx, sy) {
    const base = this.zTarget ? this.zTarget.z : this.z
    const z = clamp(base * f, this.minZ, MAX_Z)
    if (!this.zTarget || this.zTarget.sx !== sx || this.zTarget.sy !== sy) {
      this.zTarget = { z, sx, sy, wx: (sx - this.tx) / this.z, wy: (sy - this.ty) / this.z }
    } else this.zTarget.z = z
    this.request()
  }

  // ── sizing ───────────────────────────────────────────────────────────────
  resize() {
    const box = this.canvas.parentElement.getBoundingClientRect()
    const W = Math.max(1, Math.round(box.width)), H = Math.max(1, Math.round(box.height))
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const first = !this.W
    const c = first ? null : this._center()
    this.W = W; this.H = H; this.dpr = dpr
    this.canvas.width = Math.round(W * dpr)
    this.canvas.height = Math.round(H * dpr)
    this.canvas.style.width = W + 'px'
    this.canvas.style.height = H + 'px'
    this.minZ = clamp(this.fitZoom(this.layout.bounds, 0.04) * 0.85, 0.04, 0.3)
    if (first) {
      const p = this._pendingFit
      if (p) { this._pendingFit = null; this.fitRect(p.r, p) } else this.fitAll(false)
    } else {
      this.z = clamp(this.z, this.minZ, MAX_Z)
      this._setCenter(c.x, c.y, this.z)
    }
    this.request()
  }

  // Bake the node sprites in idle time, in small slices, so the first zoom-out
  // (which reveals every node at once) doesn't build ~300 canvases in one frame.
  prewarm() {
    const later = (fn) => { this._idle = window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 16) }
    let i = 0
    const slice = (deadline) => {
      if (this.destroyed) return
      const t0 = performance.now()
      const spare = () => (deadline?.timeRemaining ? deadline.timeRemaining() > 2 : performance.now() - t0 < 6)
      while (i < this.n && spare()) {
        const nd = this.nodes[i]
        const key = STATUS_KEY[this.status[i]]
        for (const k of [1, 2, 4]) getNodeSprite(nd.id, key, k)
        i++
      }
      if (i < this.n) later(slice)
    }
    later(slice)
  }

  // ── labels ───────────────────────────────────────────────────────────────
  prepareLabels() {
    const ctx = this.ctx
    ctx.font = `600 ${LABEL_PX}px ${FONT_UI}`
    this.lines = this.nodes.map((n) => {
      const words = n.skill.name.split(' ')
      const out = []
      let cur = ''
      for (const w of words) {
        const t = cur ? cur + ' ' + w : w
        if (cur && ctx.measureText(t).width > LABEL_W) { out.push(cur); cur = w } else cur = t
      }
      if (cur) out.push(cur)
      return out
    })
  }

  // ── input ────────────────────────────────────────────────────────────────
  _bind() {
    const cv = this.canvas
    this._listeners = []
    const on = (t, ev, fn, opt) => {
      t.addEventListener(ev, fn, opt)
      this._listeners.push([t, [ev, fn, opt]])
    }
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }

    on(cv, 'wheel', (e) => {
      e.preventDefault()
      this.flight = null; this.vx = this.vy = 0
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY
      const f = clamp(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)), 0.5, 2)
      const [sx, sy] = pos(e)
      this._zoomAt(f, sx, sy)
    }, { passive: false })

    on(cv, 'pointerdown', (e) => {
      try { cv.setPointerCapture(e.pointerId) } catch { /* pointer already gone */ }
      const [x, y] = pos(e)
      this.pointers.set(e.pointerId, { x, y })
      this.flight = null; this.vx = this.vy = 0; this.zTarget = null
      if (this.pointers.size === 1) this.drag = { x0: x, y0: y, moved: false, lx: x, ly: y, lt: e.timeStamp }
      else if (this.pointers.size === 2) {
        this.drag = null
        const [a, b] = [...this.pointers.values()]
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
      }
    })

    on(cv, 'pointermove', (e) => {
      const [x, y] = pos(e)
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x, y })
      if (this.pinch && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
        const nz = clamp(this.z * (d / this.pinch.d), this.minZ, MAX_Z)
        const wx = (this.pinch.mx - this.tx) / this.z, wy = (this.pinch.my - this.ty) / this.z
        this.z = nz
        this.tx = mx - wx * nz
        this.ty = my - wy * nz
        this._clamp()
        this.pinch = { d, mx, my }
        this.request()
        return
      }
      if (this.drag) {
        const dx = x - this.drag.lx, dy = y - this.drag.ly
        if (!this.drag.moved && Math.hypot(x - this.drag.x0, y - this.drag.y0) > 5) this.drag.moved = true
        if (this.drag.moved) {
          this.tx += dx; this.ty += dy
          this._clamp()
          const dt = Math.max(1, e.timeStamp - this.drag.lt)
          this.vx = lerp(this.vx, dx / dt, 0.5); this.vy = lerp(this.vy, dy / dt, 0.5)
          this.canvas.style.cursor = 'grabbing'
          this.request()
        }
        this.drag.lx = x; this.drag.ly = y; this.drag.lt = e.timeStamp
      } else if (e.pointerType === 'mouse') {
        const h = this.hit(x, y)
        if (h !== this.hov) {
          this.hov = h
          this.canvas.style.cursor = h >= 0 ? 'pointer' : 'grab'
          this.request()
        }
      }
    })

    const up = (e) => {
      const had = this.pointers.delete(e.pointerId)
      if (this.pointers.size < 2) this.pinch = null
      if (!had) return
      if (this.drag && this.pointers.size === 0) {
        const [x, y] = pos(e)
        if (!this.drag.moved) this.onSelect(this.hit(x, y))
        else if (!reduceMotion() && e.timeStamp - this.drag.lt < 80) this.request() // inertia
        else { this.vx = this.vy = 0 }
        this.drag = null
        this.canvas.style.cursor = this.hov >= 0 ? 'pointer' : 'grab'
      }
    }
    on(cv, 'pointerup', up)
    on(cv, 'pointercancel', up)
    on(cv, 'pointerleave', () => { if (this.hov !== -1) { this.hov = -1; this.request() } })

    on(cv, 'dblclick', (e) => {
      const [x, y] = pos(e)
      if (this.hit(x, y) < 0) this._zoomAt(1.8, x, y)
    })

    on(cv, 'keydown', (e) => {
      const step = 90
      const k = e.key
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
        this.flight = null
        this.tx += k === 'ArrowLeft' ? step : k === 'ArrowRight' ? -step : 0
        this.ty += k === 'ArrowUp' ? step : k === 'ArrowDown' ? -step : 0
        this._clamp(); this.request(); e.preventDefault()
      } else if (k === '+' || k === '=') { this.zoomBy(1.3); e.preventDefault() }
      else if (k === '-' || k === '_') { this.zoomBy(1 / 1.3); e.preventDefault() }
      else if (k === '0') { this.fitAll(); e.preventDefault() }
    })

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(cv.parentElement)
  }

  hit(px, py) {
    const z = this.z
    const wx = (px - this.tx) / z, wy = (py - this.ty) / z
    const pad = Math.max(2, (24 - NODE * z) / 2 / z) // keep tiny nodes clickable
    let best = -1, bd = Infinity
    for (let i = 0; i < this.n; i++) {
      const nd = this.nodes[i]
      if (wx < nd.x - pad || wx > nd.x + NODE + pad || wy < nd.y - pad || wy > nd.y + NODE + pad) continue
      const d = Math.abs(wx - nd.x - NODE / 2) + Math.abs(wy - nd.y - NODE / 2)
      if (d < bd) { bd = d; best = i }
    }
    return best
  }

  // ── loop ─────────────────────────────────────────────────────────────────
  request() {
    if (this.raf || this.destroyed) return
    this.raf = requestAnimationFrame((t) => { this.raf = 0; this.tick(t) })
  }

  tick(now) {
    const dt = Math.min(64, this.last ? now - this.last : 16)
    this.last = now
    let moving = false

    if (this.flight) {
      const f = this.flight
      const t = clamp((now - f.t0) / f.dur, 0, 1)
      const e = easeOut(t)
      this._setCenter(lerp(f.from.x, f.to.x, e), lerp(f.from.y, f.to.y, e), Math.exp(lerp(f.from.lz, f.to.lz, e)))
      if (t >= 1) this.flight = null; else moving = true
    } else if (this.zTarget) {
      const zt = this.zTarget
      const k = 1 - Math.exp(-dt / 55)
      let nz = this.z * Math.pow(zt.z / this.z, k)
      if (Math.abs(zt.z / nz - 1) < 0.002) nz = zt.z
      this.z = nz
      this.tx = zt.sx - zt.wx * nz
      this.ty = zt.sy - zt.wy * nz
      this._clamp()
      if (nz === zt.z) this.zTarget = null; else moving = true
    } else if (!this.drag && (Math.abs(this.vx) > 0.02 || Math.abs(this.vy) > 0.02)) {
      this.tx += this.vx * dt; this.ty += this.vy * dt
      const decay = Math.pow(0.0035, dt / 1000)
      this.vx *= decay; this.vy *= decay
      this._clamp()
      moving = true
    }

    this.draw(now)
    if (moving || this.bursts.length) { this.last = now; this.request() } else this.last = 0
  }

  // ── drawing ──────────────────────────────────────────────────────────────
  draw(now) {
    const { ctx, W, H, dpr, z } = this
    const S = z * dpr
    const OX = this.tx * dpr, OY = this.ty * dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, W * dpr, H * dpr)

    const vx0 = -this.tx / z - 40, vy0 = -this.ty / z - 40
    const vx1 = (W - this.tx) / z + 40, vy1 = (H - this.ty) / z + 100
    const status = this.status, dim = this.dim, nodes = this.nodes
    const lod = z < 0.17 ? 2 : z < 0.5 ? 1 : 0

    this.drawDots(S, OX, OY)
    this.drawEdges(S, OX, OY, vx0, vy0, vx1, vy1)

    // nodes
    const ns = Math.round(NODE * S)
    const artPx = ART * S // device px per art pixel on screen
    // pick the sprite mip nearest the on-screen size so scaling stays within ~±40%
    const mip = artPx >= 5 ? 6 : artPx >= 3 ? 4 : artPx >= 1.5 ? 2 : 1
    ctx.imageSmoothingEnabled = artPx < mip * 0.7
    for (let i = 0; i < this.n; i++) {
      const nd = nodes[i]
      if (nd.x > vx1 || nd.x + NODE < vx0 || nd.y > vy1 || nd.y + NODE < vy0) continue
      const x = Math.round(nd.x * S + OX), y = Math.round(nd.y * S + OY)
      const st = status[i]
      const faded = dim && dim[i]
      if (faded) ctx.globalAlpha = 0.22
      if (lod === 2) {
        ctx.fillStyle = st === 0 ? '#5a5476' : SKIN[STATUS_KEY[st]].frame
        ctx.fillRect(x, y, Math.max(2, ns - 2), Math.max(2, ns - 2))
      } else {
        const key = STATUS_KEY[st]
        ctx.drawImage(getNodeSprite(nd.id, key, mip), x, y, ns, ns)
        if (lod === 0) {
          if (nd.skill.star) {
            const b = getBadge('star', COLOR.gold, '#1a1408'), bs = Math.round(b.width / 4 * artPx)
            ctx.drawImage(b, x + ns - Math.round(bs * 0.72), y - Math.round(bs * 0.28), bs, bs)
          }
          if (this.adapt[i] > 0) {
            const b = getBadge('gear', '#a6e35a', '#0f1a08'), bs = Math.round(b.width / 4 * artPx)
            ctx.drawImage(b, x + ns - Math.round(bs * 0.72), y + ns - Math.round(bs * 0.72), bs, bs)
          }
        }
      }
      if (faded) ctx.globalAlpha = 1
      if (i === this.sel || i === this.hov) {
        const t = Math.max(1, Math.round(artPx * (i === this.sel ? 1.4 : 0.9)))
        const o = Math.round(artPx * 0.9)
        ctx.fillStyle = i === this.sel ? '#ffffff' : 'rgba(242,239,230,0.6)'
        ctx.fillRect(x - o, y - o + 1, ns + o * 2, t)
        ctx.fillRect(x - o, y + ns + o - t - 1, ns + o * 2, t)
        ctx.fillRect(x - o, y - o + 1, t, ns + o * 2 - 2)
        ctx.fillRect(x + ns + o - t, y - o + 1, t, ns + o * 2 - 2)
      }
    }

    this.drawLabels(S, OX, OY, vx0, vy0, vx1, vy1, lod)
    this.drawTitles(S, OX, OY, vx0, vx1, lod)
    this.drawBursts(now, S, OX, OY)
  }

  drawDots(S, OX, OY) {
    const step = 60 * S
    if (step < 26) return // too dense to read as a grid, and pure cost
    const { ctx, W, H, dpr } = this
    const d = Math.max(1, Math.round(S * 2))
    ctx.fillStyle = 'rgba(141,135,166,0.16)'
    ctx.beginPath()
    const x0 = Math.floor(-OX / step), x1 = Math.ceil((W * dpr - OX) / step)
    const y0 = Math.floor(-OY / step), y1 = Math.ceil((H * dpr - OY) / step)
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) ctx.rect(Math.round(i * step + OX), Math.round(j * step + OY), d, d)
    ctx.fill()
  }

  drawEdges(S, OX, OY, vx0, vy0, vx1, vy1) {
    const { ctx, nodes, status, dim, sel, hov } = this
    const lw = Math.max(1, Math.round(2 * S))
    const h = lw & 1 ? 0.5 : 0
    const a = Math.max(1, Math.round(S * 1.5)) // arrow "pixel"
    const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()]
    const arrows = [new Path2D(), new Path2D(), new Path2D(), new Path2D()]
    const lit = new Path2D(), litArrows = new Path2D(), litCross = new Path2D(), faint = new Path2D()
    let hasLit = false

    for (const e of this.layout.edges) {
      const s = nodes[e.s], t = nodes[e.t]
      const isLit = (sel >= 0 && (e.s === sel || e.t === sel)) || (hov >= 0 && (e.s === hov || e.t === hov))
      if (e.cross && !isLit) continue // cross-branch links only show for the skill you point at
      const sx = s.x + NODE / 2, sy = s.y + NODE, tx = t.x + NODE / 2, ty = t.y
      if (Math.max(sx, tx) < vx0 || Math.min(sx, tx) > vx1 || Math.max(sy, ty) < vy0 || Math.min(sy, ty) > vy1) continue
      const st = status[e.s]
      const faded = dim && dim[e.s] && dim[e.t] && !isLit
      const X0 = Math.round(sx * S + OX) + h, Y0 = Math.round(sy * S + OY)
      const X1 = Math.round(tx * S + OX) + h, Y1 = Math.round(ty * S + OY)
      const p = e.cross ? litCross : isLit ? lit : faded ? faint : paths[st]

      if (e.cross) {
        p.moveTo(X0, Y0); p.lineTo(X1, Y1 - 3 * a)
      } else {
        const my = Math.round(Y0 + Math.min(Y1 - Y0, ROW_GAP * S) * 0.5) + h
        p.moveTo(X0, Y0); p.lineTo(X0, my); p.lineTo(X1, my); p.lineTo(X1, Y1 - 3 * a)
      }
      if (faded) continue
      const ap = isLit ? litArrows : arrows[st]
      const ax = Math.round(tx * S + OX)
      ap.rect(ax - Math.round(2.5 * a), Y1 - 3 * a, 5 * a, a)
      ap.rect(ax - Math.round(1.5 * a), Y1 - 2 * a, 3 * a, a)
      ap.rect(ax - Math.round(0.5 * a), Y1 - a, a, a)
      if (isLit) hasLit = true
    }

    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'
    ctx.lineWidth = lw
    ctx.globalAlpha = 0.14; ctx.strokeStyle = EDGE[0]; ctx.stroke(faint); ctx.globalAlpha = 1
    for (let k = 0; k < 4; k++) {
      ctx.strokeStyle = EDGE[k]; ctx.stroke(paths[k])
      ctx.fillStyle = EDGE[k]; ctx.fill(arrows[k])
    }
    if (hasLit) {
      ctx.lineWidth = lw + Math.max(1, Math.round(S)); ctx.strokeStyle = '#ffffff'; ctx.stroke(lit)
      ctx.setLineDash([Math.round(8 * S), Math.round(6 * S)]); ctx.stroke(litCross); ctx.setLineDash([])
      ctx.fillStyle = '#ffffff'; ctx.fill(litArrows)
    }
  }

  drawLabels(S, OX, OY, vx0, vy0, vx1, vy1, lod) {
    const { ctx, nodes, lines, dpr } = this
    const showAll = this.z >= 0.7
    const px = Math.max(1, Math.round(LABEL_PX * S))
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    ctx.font = `600 ${px}px ${FONT_UI}`
    const lh = Math.round(px * 1.15)
    const draw = (i, plate) => {
      const nd = nodes[i]
      const cx = Math.round((nd.x + NODE / 2) * S + OX)
      let y = Math.round((nd.y + NODE) * S + OY) + Math.round(6 * S)
      const faded = this.dim && this.dim[i]
      ctx.globalAlpha = faded ? 0.22 : 1
      const st = this.status[i]
      for (const line of lines[i]) {
        if (plate) {
          const w = Math.ceil(ctx.measureText(line).width) + 8 * dpr
          ctx.fillStyle = 'rgba(15,13,23,0.92)'
          ctx.fillRect(cx - w / 2, y - 2 * dpr, w, lh + 2 * dpr)
        }
        ctx.fillStyle = 'rgba(15,13,23,0.95)'
        ctx.fillText(line, cx + dpr, y + dpr)
        ctx.fillStyle = st === 0 ? '#9a94b4' : COLOR.text
        ctx.fillText(line, cx, y)
        y += lh
      }
      ctx.globalAlpha = 1
    }
    if (showAll && lod === 0) {
      for (let i = 0; i < this.n; i++) {
        const nd = nodes[i]
        if (nd.x > vx1 || nd.x + NODE < vx0 || nd.y > vy1 || nd.y + NODE < vy0) continue
        draw(i, false)
      }
    } else {
      if (this.hov >= 0 && this.z >= 0.2) draw(this.hov, true)
      if (this.sel >= 0 && this.sel !== this.hov && this.z >= 0.2) draw(this.sel, true)
    }
  }

  drawTitles(S, OX, OY, vx0, vx1, lod) {
    const { ctx, dpr } = this
    const px = clamp(Math.round(17 * S), Math.round(10 * dpr), Math.round(22 * dpr))
    ctx.font = `700 ${px}px ${FONT_TITLE}`
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
    let right = -Infinity
    for (const t of this.layout.titles) {
      if (t.cx + t.w / 2 < vx0 || t.cx - t.w / 2 > vx1) continue
      const y = Math.round(t.y * S + OY) + (lod === 2 ? Math.round(px * 0.3) : 0)
      const cx = Math.round(t.cx * S + OX)
      const full = t.branch.toUpperCase()
      const colPx = t.w * S
      let text = full
      if (ctx.measureText(full).width > colPx * 1.05) text = t.short.toUpperCase()
      const w = ctx.measureText(text).width
      if (cx - w / 2 < right + 8 * dpr) continue
      right = cx + w / 2
      ctx.fillStyle = FAMILY_INK[t.family] || COLOR.text
      ctx.fillText(text, cx, y)
      const bar = Math.max(1, Math.round(2 * S)), bw = Math.min(colPx * 0.9, Math.max(w, colPx * 0.3))
      ctx.globalAlpha = 0.5
      ctx.fillRect(Math.round(cx - bw / 2), y + Math.round(10 * S) + 2, Math.round(bw), bar)
      ctx.globalAlpha = 1
    }
  }

  drawBursts(now, S, OX, OY) {
    if (!this.bursts.length) return
    const { ctx } = this
    this.bursts = this.bursts.filter((b) => now - b.t0 < BURST_MS)
    for (const b of this.bursts) {
      const k = (now - b.t0) / BURST_MS
      const nd = this.nodes[b.i]
      const cx = (nd.x + NODE / 2) * S + OX, cy = (nd.y + NODE / 2) * S + OY
      const col = SKIN[STATUS_KEY[b.st]].frame
      ctx.fillStyle = col
      ctx.globalAlpha = 1 - k
      // square shock-ring, stepped to the art grid
      const r = Math.round((NODE / 2 + easeOut(k) * NODE * 0.9) * S)
      const t = Math.max(1, Math.round(ART * S))
      const q = Math.round(r / t) * t
      ctx.fillRect(cx - q, cy - q, q * 2, t); ctx.fillRect(cx - q, cy + q - t, q * 2, t)
      ctx.fillRect(cx - q, cy - q, t, q * 2); ctx.fillRect(cx + q - t, cy - q, t, q * 2)
      // eight sparks
      const sp = Math.max(2, Math.round(ART * S * 1.2))
      const d = Math.round((NODE * 0.55 + easeOut(k) * NODE * 1.1) * S)
      for (let j = 0; j < 8; j++) {
        const ang = (j * Math.PI) / 4
        ctx.fillRect(Math.round(cx + Math.cos(ang) * d - sp / 2), Math.round(cy + Math.sin(ang) * d - sp / 2), sp, sp)
      }
      ctx.globalAlpha = 1
    }
  }
}

